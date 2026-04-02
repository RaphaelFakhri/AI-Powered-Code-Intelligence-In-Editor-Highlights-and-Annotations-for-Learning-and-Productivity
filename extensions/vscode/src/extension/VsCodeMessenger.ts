import { ConfigHandler } from "core/config/ConfigHandler";
import { DataLogger } from "core/data/log";
import { EDIT_MODE_STREAM_ID } from "core/edit/constants";
import {
  FromCoreProtocol,
  FromWebviewProtocol,
  ToCoreProtocol,
} from "core/protocol";
import { ToWebviewFromCoreProtocol } from "core/protocol/coreWebview";
import { ToIdeFromWebviewOrCoreProtocol } from "core/protocol/ide";
import { ToIdeFromCoreProtocol } from "core/protocol/ideCore";
import { InProcessMessenger, Message } from "core/protocol/messenger";
import {
  CORE_TO_WEBVIEW_PASS_THROUGH,
  WEBVIEW_TO_CORE_PASS_THROUGH,
} from "core/protocol/passThrough";
import { stripImages } from "core/util/messageContent";
import { normalizeRepoUrl } from "core/util/repoUrl";
import {
  sanitizeShellArgument,
  validateGitHubRepoUrl,
} from "core/util/sanitization";
import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

import { ApplyManager } from "../apply";
import { VerticalDiffManager } from "../diff/vertical/manager";
import { addCurrentSelectionToEdit } from "../quickEdit/AddCurrentSelection";
import EditDecorationManager from "../quickEdit/EditDecorationManager";
import {
  getControlPlaneSessionInfo,
  WorkOsAuthProvider,
} from "../stubs/WorkOsAuthProvider";
import { handleLLMError } from "../util/errorHandling";
import { showTutorial } from "../util/tutorial";
import { getExtensionUri } from "../util/vscode";
import { VsCodeIde } from "../VsCodeIde";
import { VsCodeWebviewProtocol } from "../webviewProtocol";

import { encodeFullSlug } from "../../../../packages/config-yaml/dist";
import { VsCodeExtension } from "./VsCodeExtension";

type ToIdeOrWebviewFromCoreProtocol = ToIdeFromCoreProtocol &
  ToWebviewFromCoreProtocol;

/**
 * A shared messenger class between Core and Webview
 * so we don't have to rewrite some of the handlers
 */
export class VsCodeMessenger {
  private voiceSelectionProcess: childProcess.ChildProcessWithoutNullStreams | null =
    null;
  private voiceOutputBuffer = "";
  private voiceSessionStart: number | null = null;
  private activeFetchControllers: Set<AbortController> = new Set();
  private gazePanel: vscode.WebviewPanel | null = null;
  private gazeLingerDebounce: NodeJS.Timeout | null = null;

  onWebview<T extends keyof FromWebviewProtocol>(
    messageType: T,
    handler: (
      message: Message<FromWebviewProtocol[T][0]>,
    ) => Promise<FromWebviewProtocol[T][1]> | FromWebviewProtocol[T][1],
  ): void {
    void this.webviewProtocol.on(messageType, handler);
  }

  onCore<T extends keyof ToIdeOrWebviewFromCoreProtocol>(
    messageType: T,
    handler: (
      message: Message<ToIdeOrWebviewFromCoreProtocol[T][0]>,
    ) =>
      | Promise<ToIdeOrWebviewFromCoreProtocol[T][1]>
      | ToIdeOrWebviewFromCoreProtocol[T][1],
  ): void {
    this.inProcessMessenger.externalOn(messageType, handler);
  }

  onWebviewOrCore<T extends keyof ToIdeFromWebviewOrCoreProtocol>(
    messageType: T,
    handler: (
      message: Message<ToIdeFromWebviewOrCoreProtocol[T][0]>,
    ) =>
      | Promise<ToIdeFromWebviewOrCoreProtocol[T][1]>
      | ToIdeFromWebviewOrCoreProtocol[T][1],
  ): void {
    this.onWebview(messageType, handler);
    this.onCore(messageType, handler);
  }

  constructor(
    private readonly inProcessMessenger: InProcessMessenger<
      ToCoreProtocol,
      FromCoreProtocol
    >,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
    private readonly ide: VsCodeIde,
    private readonly verticalDiffManagerPromise: Promise<VerticalDiffManager>,
    private readonly configHandlerPromise: Promise<ConfigHandler>,
    private readonly workOsAuthProvider: WorkOsAuthProvider,
    private readonly editDecorationManager: EditDecorationManager,
    private readonly context: vscode.ExtensionContext,
    private readonly vsCodeExtension: VsCodeExtension,
  ) {
    /** WEBVIEW ONLY LISTENERS **/
    this.onWebview("showFile", (msg) => {
      this.ide.openFile(msg.data.filepath);
    });

    this.onWebview("vscode/openMoveRightMarkdown", (msg) => {
      vscode.commands.executeCommand(
        "markdown.showPreview",
        vscode.Uri.joinPath(
          getExtensionUri(),
          "media",
          "move-chat-panel-right.md",
        ),
      );
    });

    this.onWebview("toggleDevTools", (msg) => {
      vscode.commands.executeCommand("continue.viewLogs");
    });

    this.onWebview("reloadWindow", (msg) => {
      vscode.commands.executeCommand("workbench.action.reloadWindow");
    });
    this.onWebview("focusEditor", (msg) => {
      vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    });
    this.onWebview("toggleFullScreen", (msg) => {
      vscode.commands.executeCommand("continue.openInNewWindow");
    });

    this.onWebview("voiceSelectionStart", async () => {
      console.log(
        "[Voice] onWebview 'voiceSelectionStart' received from webview",
      );
      await this.startVoiceSelection();
    });

    this.onWebview("voiceSelectionStop", async () => {
      console.log(
        "[Voice] onWebview 'voiceSelectionStop' received from webview",
      );
      this.stopVoiceSelection();
    });

    this.onWebview("voiceTtsSpeak", async ({ data }) => {
      console.log(
        "[Voice] onWebview 'voiceTtsSpeak', text length:",
        data.text.length,
      );
      await this.speakTts(data.text);
    });

    this.onWebview("voiceTtsStop", async () => {
      console.log("[Voice] onWebview 'voiceTtsStop'");
    });

    this.onWebview("gazeStart", async () => {
      console.log("[Gaze] onWebview 'gazeStart'");
      this.openGazePanel();
    });

    this.onWebview("gazeStop", async () => {
      console.log("[Gaze] onWebview 'gazeStop'");
      this.closeGazePanel();
    });

    this.onWebview("acceptDiff", async ({ data: { filepath, streamId } }) => {
      await vscode.commands.executeCommand(
        "continue.acceptDiff",
        filepath,
        streamId,
      );
    });

    this.context.subscriptions.push({
      dispose: () => {
        console.log(
          "[Voice][BILLING] Extension dispose: cleaning up voice + aborting fetches",
        );
        this.stopVoiceSelection();
        // Abort all in-flight HTTP requests (TTS, LLM)
        for (const controller of this.activeFetchControllers) {
          controller.abort();
        }
        this.activeFetchControllers.clear();
      },
    });

    this.onWebview("rejectDiff", async ({ data: { filepath, streamId } }) => {
      await vscode.commands.executeCommand(
        "continue.rejectDiff",
        filepath,
        streamId,
      );
    });

    this.onWebview("applyToFile", async ({ data }) => {
      const [verticalDiffManager, configHandler] = await Promise.all([
        verticalDiffManagerPromise,
        configHandlerPromise,
      ]);

      const applyManager = new ApplyManager(
        this.ide,
        webviewProtocol,
        verticalDiffManager,
        configHandler,
      );

      await applyManager.applyToFile(data);
    });

    this.onWebview("showTutorial", async (msg) => {
      await showTutorial(this.ide);
    });

    this.onWebview(
      "overwriteFile",
      async ({ data: { prevFileContent, filepath } }) => {
        if (prevFileContent === null) {
          // TODO: Delete the file
          return;
        }

        await this.ide.openFile(filepath);

        // Get active text editor
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
          vscode.window.showErrorMessage("No active editor to apply edits to");
          return;
        }

        editor.edit((builder) =>
          builder.replace(
            new vscode.Range(
              editor.document.positionAt(0),
              editor.document.positionAt(editor.document.getText().length),
            ),
            prevFileContent,
          ),
        );
      },
    );

    this.onWebview("insertAtCursor", async (msg) => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined || !editor.selection) {
        return;
      }

      editor.edit((editBuilder) => {
        editBuilder.replace(
          new vscode.Range(editor.selection.start, editor.selection.end),
          msg.data.text,
        );
      });
    });

    this.onWebview(
      "insertCommentAbove",
      async ({ data: { filepath, line, comment } }) => {
        await this.ide.openFile(filepath);

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage("No active editor to insert comment");
          return;
        }

        const lineIndex = Math.max(0, line - 1);
        const insertPosition = new vscode.Position(lineIndex, 0);

        await editor.edit((editBuilder) => {
          editBuilder.insert(insertPosition, `${comment}\n`);
        });
      },
    );
    this.onWebview("edit/addCurrentSelection", async (msg) => {
      const verticalDiffManager = await this.verticalDiffManagerPromise;
      await addCurrentSelectionToEdit({
        args: undefined,
        editDecorationManager,
        webviewProtocol: this.webviewProtocol,
        verticalDiffManager,
      });
    });
    this.onWebview("edit/sendPrompt", async (msg) => {
      const prompt = msg.data.prompt;
      const { start, end } = msg.data.range.range;
      const verticalDiffManager = await verticalDiffManagerPromise;

      const configHandler = await configHandlerPromise;
      const { config } = await configHandler.loadConfig();

      if (!config) {
        throw new Error("Edit: Failed to load config");
      }

      const model =
        config?.selectedModelByRole.edit ?? config?.selectedModelByRole.chat;

      if (!model) {
        throw new Error("No Edit or Chat model selected");
      }

      const fileAfterEdit = await verticalDiffManager.streamEdit({
        input: stripImages(prompt),
        llm: model,
        streamId: EDIT_MODE_STREAM_ID,
        range: new vscode.Range(
          new vscode.Position(start.line, start.character),
          new vscode.Position(end.line, end.character),
        ),
        rulesToInclude: config.rules,
        isApply: false,
      });

      // Log dev data
      await DataLogger.getInstance().logDevData({
        name: "editInteraction",
        data: {
          prompt: stripImages(prompt),
          completion: fileAfterEdit ?? "",
          modelProvider: model.underlyingProviderName,
          modelName: model.title ?? "",
          modelTitle: model.title ?? "",
          filepath: msg.data.range.filepath,
        },
      });

      return fileAfterEdit;
    });

    this.onWebview("edit/clearDecorations", async (msg) => {
      editDecorationManager.clear();
    });

    this.onWebview("session/share", async (msg) => {
      await vscode.commands.executeCommand(
        "continue.shareSession",
        msg.data.sessionId,
      );
    });

    this.onWebview("createBackgroundAgent", async (msg) => {
      const configHandler = await configHandlerPromise;
      const { content, contextItems, selectedCode, organizationId } = msg.data;

      // Convert resolved content to plain text prompt
      const prompt = stripImages(content);

      if (!prompt || prompt.trim().length === 0) {
        vscode.window.showErrorMessage(
          "Please enter a prompt to create a background agent",
        );
        return;
      }

      // Get workspace information
      const workspaceDirs = await this.ide.getWorkspaceDirs();
      if (workspaceDirs.length === 0) {
        vscode.window.showErrorMessage(
          "No workspace folder found. Please open a workspace to create a background agent.",
        );
        return;
      }

      const workspaceDir = workspaceDirs[0];
      let repoUrl = "";
      let branch = "";

      try {
        // Get repo name/URL
        const repoName = await this.ide.getRepoName(workspaceDir);
        if (repoName) {
          // Normalize the URL first to get canonical form
          const normalized = normalizeRepoUrl(repoName);

          // Validate the normalized URL to prevent injection attacks
          // This ensures we validate what we'll actually use, not just the input
          if (!validateGitHubRepoUrl(normalized)) {
            vscode.window.showErrorMessage(
              "Invalid repository format. Please ensure you're using a valid GitHub repository.",
            );
            return;
          }

          repoUrl = normalized;
        }

        // Get current branch
        const branchInfo = await this.ide.getBranch(workspaceDir);
        if (branchInfo) {
          branch = branchInfo;
        }
      } catch (e) {
        console.error("Error getting repo info:", e);
      }

      if (!repoUrl) {
        vscode.window.showErrorMessage(
          "Unable to determine repository URL. Make sure you're in a git repository.",
        );
        return;
      }

      // Generate a name from the prompt (first 50 chars, cleaned up)
      let name = prompt.substring(0, 50).replace(/\n/g, " ").trim();
      if (prompt.length > 50) {
        name += "...";
      }
      // Fallback to a generic name if prompt is too short
      if (name.length < 3) {
        const repoName = await this.ide.getRepoName(workspaceDir);
        name = `Agent for ${repoName || "repository"}`;
      }

      // Get the current agent configuration from the selected profile
      let agent: string | undefined;
      try {
        const currentProfile = configHandler.currentProfile;
        if (
          currentProfile &&
          currentProfile.profileDescription.profileType !== "local"
        ) {
          // Encode the full slug to pass as the agent parameter
          agent = encodeFullSlug(currentProfile.profileDescription.fullSlug);
        }
      } catch (e) {
        console.error("Error getting agent configuration from profile:", e);
        // Continue without agent config - will use default
      }

      // Create the background agent
      try {
        console.log("Creating background agent with:", {
          name,
          prompt: prompt.substring(0, 50) + "...",
          repoUrl,
          branch,
          contextItemsCount: contextItems?.length || 0,
          selectedCodeCount: selectedCode?.length || 0,
          agent: agent || "default",
        });

        const result =
          await configHandler.controlPlaneClient.createBackgroundAgent(
            prompt,
            repoUrl,
            name,
            branch,
            organizationId,
            contextItems,
            selectedCode,
            agent,
          );

        vscode.window.showInformationMessage(
          `Background agent created successfully! Agent ID: ${result.id}`,
        );
      } catch (e) {
        console.error("Failed to create background agent:", e);
        const errorMessage =
          e instanceof Error ? e.message : "Unknown error occurred";

        // Check if this is a GitHub authorization error
        if (
          errorMessage.includes("GitHub token") ||
          errorMessage.includes("GitHub App")
        ) {
          const selection = await vscode.window.showErrorMessage(
            "Background agents need GitHub access. Please connect your GitHub account to Continue.",
            "Connect GitHub",
            "Cancel",
          );

          if (selection === "Connect GitHub") {
            await this.inProcessMessenger.externalRequest(
              "controlPlane/openUrl",
              {
                path: "settings/integrations",
                orgSlug: configHandler.currentOrg?.slug,
              },
            );
          }
        } else {
          vscode.window.showErrorMessage(
            `Failed to create background agent: ${errorMessage}`,
          );
        }
      }
    });

    this.onWebview("listBackgroundAgents", async (msg) => {
      const configHandler = await configHandlerPromise;
      const { organizationId, limit } = msg.data;

      try {
        const result =
          await configHandler.controlPlaneClient.listBackgroundAgents(
            organizationId,
            limit,
          );
        return result;
      } catch (e) {
        console.error("Error listing background agents:", e);
        return { agents: [], totalCount: 0 };
      }
    });

    this.onWebview("openAgentLocally", async (msg) => {
      const configHandler = await configHandlerPromise;
      const { agentSessionId } = msg.data;

      try {
        // First, fetch the agent session to get repo URL and branch
        const agentSession =
          await configHandler.controlPlaneClient.getAgentSession(
            agentSessionId,
          );
        if (!agentSession) {
          vscode.window.showErrorMessage(
            "Failed to load agent session details.",
          );
          return;
        }

        const repoUrl = agentSession.repoUrl;
        const branch = agentSession.branch;

        if (!repoUrl || !branch) {
          vscode.window.showErrorMessage(
            "Agent session is missing repository or branch information.",
          );
          return;
        }

        // Validate the repo URL from API response to prevent injection attacks
        if (!validateGitHubRepoUrl(repoUrl)) {
          vscode.window.showErrorMessage(
            "Invalid repository URL from agent session. Please contact support.",
          );
          return;
        }

        // Get workspace directories
        const workspaceDirs = await this.ide.getWorkspaceDirs();
        if (workspaceDirs.length === 0) {
          vscode.window.showErrorMessage("No workspace folder is open.");
          return;
        }

        // Normalize and validate again to ensure the normalized form is safe
        const normalizedAgentRepo = normalizeRepoUrl(repoUrl);
        if (!validateGitHubRepoUrl(normalizedAgentRepo)) {
          vscode.window.showErrorMessage(
            "Invalid repository URL after normalization. Please contact support.",
          );
          return;
        }

        // Find the workspace that matches the agent's repo URL
        let matchingWorkspace: string | null = null;
        for (const workspaceDir of workspaceDirs) {
          const repoName = await this.ide.getRepoName(workspaceDir);
          if (repoName) {
            const normalizedRepoName = normalizeRepoUrl(repoName);

            if (normalizedRepoName === normalizedAgentRepo) {
              matchingWorkspace = workspaceDir;
              break;
            }
          }
        }

        if (!matchingWorkspace) {
          vscode.window.showErrorMessage(
            `This agent is for repository ${repoUrl}. Please open that workspace to take over the workflow.`,
          );
          return;
        }

        // Get the git repository
        const repo = await this.ide.getRepo(matchingWorkspace);
        if (!repo) {
          vscode.window.showErrorMessage("Could not access git repository.");
          return;
        }

        // Ask user what to do with uncommitted changes
        if (
          repo.state.workingTreeChanges.length > 0 ||
          repo.state.indexChanges.length > 0
        ) {
          const changeCount =
            repo.state.workingTreeChanges.length +
            repo.state.indexChanges.length;

          const choice = await vscode.window.showWarningMessage(
            `You have ${changeCount} uncommitted change(s). What would you like to do?`,
            "Stash & Continue",
            "Continue Without Stashing",
            "Cancel",
          );

          if (choice === "Cancel" || !choice) {
            return;
          }

          if (choice === "Stash & Continue") {
            try {
              await vscode.window.withProgress(
                {
                  location: vscode.ProgressLocation.Notification,
                  title: "Stashing local changes...",
                  cancellable: false,
                },
                async () => {
                  const workspacePath =
                    vscode.Uri.parse(matchingWorkspace).fsPath;
                  // Sanitize agentSessionId to prevent command injection
                  const stashMessage = `Continue: Stashed before opening agent ${agentSessionId}`;
                  await this.ide.subprocess(
                    `git stash push -m ${sanitizeShellArgument(stashMessage)}`,
                    workspacePath,
                  );
                },
              );
              vscode.window.showInformationMessage(
                "Local changes have been stashed.",
              );
            } catch (e) {
              console.error("Failed to stash changes:", e);
              const errorMsg = e instanceof Error ? e.message : String(e);
              vscode.window.showErrorMessage(
                `Failed to stash changes: ${errorMsg}`,
              );
              return; // Stop on stash failure
            }
          }
          // If "Continue Without Stashing" was chosen, just proceed
        }

        // Check if we're already on the target branch
        try {
          const currentBranch = await this.ide.getBranch(matchingWorkspace);
          console.log(
            `Current branch: ${currentBranch}, Target branch: ${branch}`,
          );

          if (currentBranch !== branch) {
            // Try to switch to the branch using VS Code Git API
            await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: `Switching to branch ${branch}...`,
                cancellable: false,
              },
              async () => {
                try {
                  // Use VS Code Git API for checkout
                  await repo.checkout(branch);
                } catch (checkoutError: any) {
                  console.log(
                    "Checkout failed, trying to fetch first...",
                    checkoutError,
                  );
                  // If checkout fails, fetch and try again
                  await repo.fetch();
                  await repo.checkout(branch);
                }
              },
            );
            vscode.window.showInformationMessage(
              `Switched to branch ${branch}`,
            );
          } else {
            console.log("Already on target branch, skipping checkout");
          }
        } catch (e: any) {
          console.error("Failed to switch branch:", e);
          vscode.window.showErrorMessage(
            `Failed to switch to branch ${branch}: ${e.message || String(e)}`,
          );
          return;
        }

        // Fetch the agent state
        const agentState =
          await configHandler.controlPlaneClient.getAgentState(agentSessionId);

        if (!agentState) {
          vscode.window.showErrorMessage(
            "Failed to fetch agent state from API. The agent may not exist or you may not have permission.",
          );
          return;
        }

        if (!agentState.session) {
          console.error(
            "Agent state is missing session field. Full response:",
            agentState,
          );
          vscode.window.showErrorMessage(
            "Agent state returned but missing session data. This may be a backend issue.",
          );
          return;
        }

        // For MVP: Simply load the session by sending to webview
        // The webview will dispatch the newSession action with the session data
        this.webviewProtocol.send("loadAgentSession", {
          session: agentState.session,
        });

        vscode.window.showInformationMessage(
          `Successfully loaded agent workflow: ${agentState.session.title || "Untitled"}`,
        );
      } catch (e) {
        console.error("Failed to open agent locally:", e);
        vscode.window.showErrorMessage(
          `Failed to open agent locally: ${e instanceof Error ? e.message : "Unknown error"}`,
        );
      }
    });

    /** PASS THROUGH FROM WEBVIEW TO CORE AND BACK **/
    WEBVIEW_TO_CORE_PASS_THROUGH.forEach((messageType) => {
      this.onWebview(messageType, async (msg) => {
        return await this.inProcessMessenger.externalRequest(
          messageType,
          msg.data,
          msg.messageId,
        );
      });
    });

    /** PASS THROUGH FROM CORE TO WEBVIEW AND BACK **/
    CORE_TO_WEBVIEW_PASS_THROUGH.forEach((messageType) => {
      this.onCore(messageType, async (msg) => {
        return this.webviewProtocol.request(messageType, msg.data);
      });
    });

    /** CORE ONLY LISTENERS **/
    // None right now

    /** BOTH CORE AND WEBVIEW **/
    this.onWebviewOrCore("readRangeInFile", async (msg) => {
      return await vscode.workspace
        .openTextDocument(msg.data.filepath)
        .then((document) => {
          const start = new vscode.Position(0, 0);
          const end = new vscode.Position(5, 0);
          const range = new vscode.Range(start, end);

          const contents = document.getText(range);
          return contents;
        });
    });

    this.onWebviewOrCore("getIdeSettings", async (msg) => {
      return ide.getIdeSettings();
    });
    this.onWebviewOrCore("getDiff", async (msg) => {
      return ide.getDiff(msg.data.includeUnstaged);
    });
    this.onWebviewOrCore("getTerminalContents", async (msg) => {
      return ide.getTerminalContents();
    });
    this.onWebviewOrCore("getDebugLocals", async (msg) => {
      return ide.getDebugLocals(Number(msg.data.threadIndex));
    });
    this.onWebviewOrCore("getAvailableThreads", async (msg) => {
      return ide.getAvailableThreads();
    });
    this.onWebviewOrCore("getTopLevelCallStackSources", async (msg) => {
      return ide.getTopLevelCallStackSources(
        msg.data.threadIndex,
        msg.data.stackDepth,
      );
    });
    this.onWebviewOrCore("getWorkspaceDirs", async (msg) => {
      return ide.getWorkspaceDirs();
    });
    this.onWebviewOrCore("writeFile", async (msg) => {
      return ide.writeFile(msg.data.path, msg.data.contents);
    });
    this.onWebviewOrCore("showVirtualFile", async (msg) => {
      return ide.showVirtualFile(msg.data.name, msg.data.content);
    });
    this.onWebviewOrCore("openFile", async (msg) => {
      return ide.openFile(msg.data.path);
    });
    this.onWebviewOrCore("runCommand", async (msg) => {
      await ide.runCommand(msg.data.command);
    });
    this.onWebviewOrCore("getSearchResults", async (msg) => {
      return ide.getSearchResults(msg.data.query, msg.data.maxResults);
    });
    this.onWebviewOrCore("getFileResults", async (msg) => {
      return ide.getFileResults(msg.data.pattern, msg.data.maxResults);
    });
    this.onWebviewOrCore("subprocess", async (msg) => {
      return ide.subprocess(msg.data.command, msg.data.cwd);
    });
    this.onWebviewOrCore("getProblems", async (msg) => {
      return ide.getProblems(msg.data.filepath);
    });
    this.onWebviewOrCore("getBranch", async (msg) => {
      const { dir } = msg.data;
      return ide.getBranch(dir);
    });
    this.onWebviewOrCore("getOpenFiles", async (msg) => {
      return ide.getOpenFiles();
    });
    this.onWebviewOrCore("getCurrentFile", async () => {
      return ide.getCurrentFile();
    });
    this.onWebviewOrCore("getPinnedFiles", async (msg) => {
      return ide.getPinnedFiles();
    });
    this.onWebviewOrCore("showLines", async (msg) => {
      const { filepath, startLine, endLine } = msg.data;
      return ide.showLines(filepath, startLine, endLine);
    });
    this.onWebviewOrCore("showToast", (msg) => {
      this.ide.showToast(...msg.data);
    });
    this.onWebviewOrCore("getControlPlaneSessionInfo", async (msg) => {
      return getControlPlaneSessionInfo(
        msg.data.silent,
        msg.data.useOnboarding,
      );
    });
    this.onWebviewOrCore("logoutOfControlPlane", async (msg) => {
      const sessions = await this.workOsAuthProvider.getSessions();
      await Promise.all(
        sessions.map((session) => workOsAuthProvider.removeSession(session.id)),
      );
      vscode.commands.executeCommand(
        "setContext",
        "continue.isSignedInToControlPlane",
        false,
      );
    });
    this.onWebviewOrCore("saveFile", async (msg) => {
      return await ide.saveFile(msg.data.filepath);
    });
    this.onWebviewOrCore("readFile", async (msg) => {
      return await ide.readFile(msg.data.filepath);
    });
    this.onWebviewOrCore("openUrl", (msg) => {
      vscode.env.openExternal(vscode.Uri.parse(msg.data));
    });

    this.onWebviewOrCore("fileExists", async (msg) => {
      return await ide.fileExists(msg.data.filepath);
    });

    this.onWebviewOrCore("gotoDefinition", async (msg) => {
      return await ide.gotoDefinition(msg.data.location);
    });

    this.onWebviewOrCore("getReferences", async (msg) => {
      return await ide.getReferences(msg.data.location);
    });

    this.onWebviewOrCore("getDocumentSymbols", async (msg) => {
      return await ide.getDocumentSymbols(msg.data.textDocumentIdentifier);
    });

    this.onWebviewOrCore("getFileStats", async (msg) => {
      return await ide.getFileStats(msg.data.files);
    });

    this.onWebviewOrCore("getGitRootPath", async (msg) => {
      return await ide.getGitRootPath(msg.data.dir);
    });

    this.onWebviewOrCore("listDir", async (msg) => {
      return await ide.listDir(msg.data.dir);
    });

    this.onWebviewOrCore("getRepoName", async (msg) => {
      return await ide.getRepoName(msg.data.dir);
    });

    this.onWebviewOrCore("getTags", async (msg) => {
      return await ide.getTags(msg.data);
    });

    this.onWebviewOrCore("getIdeInfo", async (msg) => {
      return await ide.getIdeInfo();
    });

    this.onWebviewOrCore("isTelemetryEnabled", async (msg) => {
      return await ide.isTelemetryEnabled();
    });

    this.onWebviewOrCore("getUniqueId", async (msg) => {
      return await ide.getUniqueId();
    });

    this.onWebviewOrCore("reportError", async (msg) => {
      await handleLLMError(msg.data);
    });
  }

  private relayVoiceTranscriptLine(line: string) {
    const trimmed = line.trim();
    console.log(
      "[Voice] relayVoiceTranscriptLine raw line:",
      JSON.stringify(line),
    );
    if (!trimmed) {
      console.log("[Voice] relayVoiceTranscriptLine: empty line, skipping");
      return;
    }

    // Forward billing logs from transcribe.js to VS Code output
    if (trimmed.startsWith("[BILLING]")) {
      console.log("[Voice:child]", trimmed);
      return;
    }

    let transcript: string | null = null;

    if (trimmed.startsWith("DG_FINAL:")) {
      transcript = trimmed.slice("DG_FINAL:".length).trim();
      console.log(
        `[Voice][TIMING] DG_FINAL received at ${new Date().toISOString()}, transcript:`,
        JSON.stringify(transcript),
      );
    } else if (trimmed.startsWith(">>>")) {
      transcript = trimmed.replace(/^>>>\s*/, "").trim();
      console.log(
        "[Voice] >>> prefix detected, transcript:",
        JSON.stringify(transcript),
      );
    } else {
      console.log(
        "[Voice] Line did not match DG_FINAL: or >>> prefix, ignored:",
        JSON.stringify(trimmed),
      );
      return;
    }

    if (!transcript) {
      console.log("[Voice] transcript was empty, not sending");
      return;
    }

    // Classify: local fast-path first, then LLM fallback
    void this.classifyAndSendVoiceIntent(transcript);
  }

  private readVoiceConfig(): Record<string, string> {
    const scriptPath = this.resolveVoiceScriptPosixPath();
    if (!scriptPath) return {};
    try {
      const configPath = path.join(path.dirname(scriptPath), "config.yaml");
      const content = fs.readFileSync(configPath, "utf8");
      const result: Record<string, string> = {};
      for (const line of content.split("\n")) {
        const match = line.match(/^\s*(\w+)\s*:\s*['"]?([^'"\n]+)['"]?\s*$/);
        if (match) result[match[1]] = match[2].trim();
      }
      return result;
    } catch {
      return {};
    }
  }

  // ─── Local fast-path voice command parser (no LLM needed) ─────────

  private static readonly WORD_TO_NUMBER: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
    hundred: 100,
  };

  private parseSpokenNumber(value: string): number | null {
    const trimmed = value.trim().toLowerCase().replace(/-/g, " ");
    const asInt = Number.parseInt(trimmed, 10);
    if (/^\d+$/.test(trimmed) && Number.isFinite(asInt) && asInt >= 0) {
      return asInt;
    }
    const tokens = trimmed.split(/\s+/);
    let current = 0;
    let matched = false;
    for (const token of tokens) {
      if (token === "and" || token === "a") continue;
      const val = VsCodeMessenger.WORD_TO_NUMBER[token];
      if (val === undefined) {
        if (matched) break;
        return null;
      }
      matched = true;
      if (val === 100) {
        current = (current === 0 ? 1 : current) * 100;
      } else {
        current += val;
      }
    }
    return matched && current > 0 ? current : null;
  }

  private tryLocalVoiceClassify(
    transcript: string,
  ): Record<string, unknown> | null {
    const text = transcript
      .trim()
      .toLowerCase()
      .replace(/[.,!?]+/g, "");
    if (!text) return null;

    // ── Line selection (ported from gui/src/utils/voiceCommandParser.ts) ──
    const NUM = `(\\d+(?:\\s+\\d+)*|[a-z]+(?:[\\s-]+[a-z]+)*)`;
    const rangePatterns = [
      new RegExp(
        `(?:select|highlight)\\s+lines?\\s+${NUM}\\s*(?:to|through|-)\\s*${NUM}`,
      ),
      new RegExp(`lines?\\s+${NUM}\\s*(?:to|through|-)\\s*${NUM}`),
      new RegExp(`${NUM}\\s+(?:to|through)\\s+${NUM}`),
    ];
    const singlePatterns = [
      new RegExp(`(?:select|highlight)\\s+lines?\\s+${NUM}`),
      new RegExp(`lines?\\s+${NUM}`),
    ];

    for (const pattern of rangePatterns) {
      const match = text.match(pattern);
      if (!match || match[1] === undefined || match[2] === undefined) continue;
      const start = this.parseSpokenNumber(match[1]);
      const end = this.parseSpokenNumber(match[2]);
      if (start === null || end === null) continue;
      return {
        action: "select_lines",
        startLine: Math.min(start, end),
        endLine: Math.max(start, end),
      };
    }
    for (const pattern of singlePatterns) {
      const match = text.match(pattern);
      if (!match || match[1] === undefined) continue;
      const line = this.parseSpokenNumber(match[1]);
      if (line === null) continue;
      return { action: "select_lines", startLine: line, endLine: line };
    }

    // ── "select the whole/entire file" ──
    if (
      /\b(?:select|highlight)\s+(?:the\s+)?(?:whole|entire|full)\s+file\b/.test(
        text,
      )
    ) {
      return { action: "select_all" };
    }

    // ── "select [the] X function" / "select function X" ──
    const funcPatterns = [
      /(?:select|highlight)\s+(?:the\s+)?(\w+)\s+(?:function|method|class)/,
      /(?:select|highlight)\s+(?:function|method|class)\s+(\w+)/,
    ];
    for (const pattern of funcPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return { action: "select_function", functionName: match[1] };
      }
    }

    // ── Keyword-based intents (no LLM needed) ──
    if (
      /\b(?:overview|give\s+(?:me\s+)?(?:an?\s+)?overview|get\s+started)\b/.test(
        text,
      )
    ) {
      return { action: "overview" };
    }
    if (
      /\b(?:tell\s+(?:me\s+)?(?:about\s+)?(?:the\s+)?api|explain\s+(?:the\s+)?api|api\s+explain|(?:give|show)\s+(?:me\s+)?(?:the\s+)?api)\b/.test(
        text,
      )
    ) {
      return { action: "explain_api" };
    }
    if (/\b(?:explain\s+(?:the\s+)?usage|usage\s+explain)\b/.test(text)) {
      return { action: "explain_usage" };
    }
    if (/\b(?:explain\s+(?:the\s+)?concept|concept\s+explain)\b/.test(text)) {
      return { action: "explain_concept" };
    }
    if (
      /\b(?:explain|explain\s+this|explain\s+(?:the\s+)?code)\b/.test(text) &&
      !/\b(?:api|usage|concept)\b/.test(text)
    ) {
      return { action: "explain_concept" };
    }
    if (
      /\b(?:add\s+comment|inline\s+comment|add\s+inline\s+comment)\b/.test(text)
    ) {
      return { action: "inline_comment" };
    }

    // ── "custom prompt/question: ..." ──
    const customMatch = text.match(
      /\b(?:custom\s+(?:prompt|question)|ask\s+(?:a\s+)?custom\s+(?:question|prompt))\s*[,:.]?\s*(.*)/,
    );
    if (customMatch && customMatch[1]?.trim()) {
      return { action: "custom_prompt", customPrompt: customMatch[1].trim() };
    }

    return null; // no local match → fall through to LLM
  }

  // ─── Voice intent classification ─────────────────────────────────

  private async classifyAndSendVoiceIntent(transcript: string) {
    const t0 = Date.now();
    console.log(
      "[Voice][TIMING] classifyAndSendVoiceIntent START:",
      JSON.stringify(transcript),
    );

    // ── Fast path: try local regex parsing first (no network) ──
    const localIntent = this.tryLocalVoiceClassify(transcript);
    if (localIntent) {
      const elapsed = Date.now() - t0;
      console.log(
        `[Voice][TIMING] LOCAL MATCH in ${elapsed}ms:`,
        JSON.stringify(localIntent),
      );
      this.webviewProtocol.send("voiceIntent", {
        ...localIntent,
        transcript,
      });
      return;
    }
    console.log(
      `[Voice][TIMING] No local match (${Date.now() - t0}ms), falling back to LLM`,
    );

    const config = this.readVoiceConfig();
    const apiKey = config.opencodeGoApiKey;
    const baseUrl =
      config.opencodeGoBaseUrl || "https://api.opencode-go.com/v1";
    const model = config.opencodeGoModel || "MiniMax-M2.7";

    if (!apiKey) {
      console.log(
        "[Voice] No opencodeGoApiKey in config.yaml, falling back to raw transcript",
      );
      this.webviewProtocol.send("voiceIntent", {
        action: "unknown",
        transcript,
      });
      return;
    }

    // Get current file contents for context
    let fileContext = "";
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const doc = editor.document;
      const fileName = path.basename(doc.uri.fsPath);
      fileContext = `\nCurrent file: ${fileName}\n\`\`\`\n${doc.getText()}\n\`\`\``;
    }

    const systemPrompt = `You are a voice command interpreter for a code editor extension. Parse the user's spoken command and return ONLY a JSON object (no markdown, no backticks).

Available actions:
1. "select_lines" - User wants to select/highlight specific lines. Return: {"action":"select_lines","startLine":N,"endLine":M}
2. "select_function" - User wants to select a function/method/class by name. Return: {"action":"select_function","functionName":"exactName"}
3. "overview" - User wants an AI overview of the selected code (like clicking "Get Started" / "Overview"). Return: {"action":"overview"}
4. "explain_api" - User wants API explanation of the code. Return: {"action":"explain_api"}
5. "explain_concept" - User wants concept explanation. Return: {"action":"explain_concept"}
6. "explain_usage" - User wants usage explanation. Return: {"action":"explain_usage"}
7. "inline_comment" - User wants to add the latest AI response as an inline comment in the code. Return: {"action":"inline_comment"}
8. "custom_prompt" - User has a custom question/request about the code. Return: {"action":"custom_prompt","customPrompt":"cleaned up prompt text"}
9. "unknown" - Cannot understand. Return: {"action":"unknown"}

The user speaks casually with filler words like "um", "like", "please", etc. Ignore those and extract the intent.
For line numbers spoken as words (e.g. "seven"), convert to digits.
For function selection, match the function name from the file contents below.
${fileContext}

Return ONLY valid JSON.`;

    try {
      const tLlmStart = Date.now();
      console.log(
        `[Voice][TIMING] LLM call START at +${tLlmStart - t0}ms | url=${baseUrl} model=${model}`,
      );
      const llmAbort = new AbortController();
      this.activeFetchControllers.add(llmAbort);
      const llmTimeout = setTimeout(() => llmAbort.abort(), 30_000);
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: transcript },
            ],
            temperature: 0,
            max_tokens: 512,
          }),
          signal: llmAbort.signal,
        });
      } finally {
        clearTimeout(llmTimeout);
        this.activeFetchControllers.delete(llmAbort);
      }

      if (!response.ok) {
        const errText = await response.text();
        console.log("[Voice] LLM API error:", response.status, errText);
        this.webviewProtocol.send("voiceIntent", {
          action: "unknown",
          transcript,
        });
        return;
      }

      const data = await response.json();
      const msg = data.choices?.[0]?.message;
      // Handle reasoning models that put output in reasoning field
      const content = (msg?.content || msg?.reasoning || "").trim();
      console.log("[Voice] LLM raw response:", JSON.stringify(content));
      console.log(
        "[Voice] LLM full message keys:",
        msg ? Object.keys(msg) : "null",
      );

      if (!content) {
        console.log("[Voice] LLM returned empty content");
        this.webviewProtocol.send("voiceIntent", {
          action: "unknown",
          transcript,
        });
        return;
      }

      // Extract JSON object from response — model may wrap it in reasoning text
      const jsonMatch = content.match(
        /\{[^{}]*"action"\s*:\s*"[^"]+?"[^{}]*\}/,
      );
      if (!jsonMatch) {
        console.log("[Voice] Could not find JSON object in LLM response");
        this.webviewProtocol.send("voiceIntent", {
          action: "unknown",
          transcript,
        });
        return;
      }
      const intent = JSON.parse(jsonMatch[0]);
      const tTotal = Date.now() - t0;
      console.log(
        `[Voice][TIMING] LLM DONE in ${Date.now() - tLlmStart}ms | total pipeline: ${tTotal}ms | intent:`,
        JSON.stringify(intent),
      );

      this.webviewProtocol.send("voiceIntent", {
        action: intent.action || "unknown",
        startLine: intent.startLine,
        endLine: intent.endLine,
        functionName: intent.functionName,
        customPrompt: intent.customPrompt,
        transcript,
      });
    } catch (err: any) {
      console.log(
        `[Voice][TIMING] classifyAndSendVoiceIntent ERROR after ${Date.now() - t0}ms:`,
        err.message,
      );
      this.webviewProtocol.send("voiceIntent", {
        action: "unknown",
        transcript,
      });
    }
  }

  private async execFileStdout(
    command: string,
    args: string[],
  ): Promise<string | null> {
    console.log("[Voice] execFileStdout:", command, args);
    return await new Promise<string | null>((resolve) => {
      childProcess.execFile(command, args, (error, stdout, stderr) => {
        if (error) {
          console.log(
            "[Voice] execFileStdout ERROR:",
            command,
            args,
            "error:",
            error.message,
          );
          if (stderr) {
            console.log("[Voice] execFileStdout stderr:", stderr);
          }
          resolve(null);
          return;
        }
        const result = stdout.trim();
        console.log(
          "[Voice] execFileStdout result:",
          JSON.stringify(result || null),
        );
        resolve(result || null);
      });
    });
  }

  private resolveVoiceScriptPosixPath(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    console.log(
      "[Voice] resolveVoiceScriptPosixPath: workspaceFolders count:",
      workspaceFolders.length,
    );
    const candidatePaths: string[] = [];

    for (const folder of workspaceFolders) {
      console.log(
        "[Voice] resolveVoiceScriptPosixPath: scanning folder:",
        folder.uri.fsPath,
      );
      let currentDir = folder.uri.fsPath;
      for (let depth = 0; depth < 6; depth++) {
        candidatePaths.push(path.join(currentDir, "tmp", "transcribe.js"));
        const parent = path.dirname(currentDir);
        if (parent === currentDir) {
          break;
        }
        currentDir = parent;
      }
    }

    console.log(
      "[Voice] resolveVoiceScriptPosixPath: candidate paths:",
      candidatePaths,
    );
    for (const candidate of candidatePaths) {
      const exists = fs.existsSync(candidate);
      console.log("[Voice]   ", candidate, "exists:", exists);
    }

    const scriptPosixPath = candidatePaths.find((candidate) =>
      fs.existsSync(candidate),
    );
    console.log(
      "[Voice] resolveVoiceScriptPosixPath result:",
      scriptPosixPath ?? "null (not found)",
    );
    return scriptPosixPath ?? null;
  }

  private async resolveWindowsProfilePosixPath(): Promise<string | null> {
    console.log(
      "[Voice] resolveWindowsProfilePosixPath: getting USERPROFILE...",
    );
    const profileWindowsPath = await this.execFileStdout("cmd.exe", [
      "/d",
      "/c",
      "echo %USERPROFILE%",
    ]);
    console.log(
      "[Voice] resolveWindowsProfilePosixPath: USERPROFILE =",
      JSON.stringify(profileWindowsPath),
    );
    if (!profileWindowsPath) {
      console.log(
        "[Voice] resolveWindowsProfilePosixPath: USERPROFILE was null, aborting",
      );
      return null;
    }

    const posixPath = await this.execFileStdout("wslpath", [
      "-u",
      profileWindowsPath,
    ]);
    console.log(
      "[Voice] resolveWindowsProfilePosixPath: posix path =",
      JSON.stringify(posixPath),
    );
    return posixPath;
  }

  private async stageVoiceScriptInWindowsDir(): Promise<string | null> {
    console.log("[Voice] stageVoiceScriptInWindowsDir: starting...");
    const sourceScriptPath = this.resolveVoiceScriptPosixPath();
    if (!sourceScriptPath) {
      console.log(
        "[Voice] stageVoiceScriptInWindowsDir: sourceScriptPath is null, aborting",
      );
      return null;
    }

    const sourceDir = path.dirname(sourceScriptPath);
    const sourceConfigPath = path.join(sourceDir, "config.yaml");
    const sourcePackagePath = path.join(sourceDir, "package.json");
    console.log("[Voice] stageVoiceScriptInWindowsDir: sourceDir:", sourceDir);
    console.log("[Voice]   config exists:", fs.existsSync(sourceConfigPath));
    console.log(
      "[Voice]   package.json exists:",
      fs.existsSync(sourcePackagePath),
    );

    const profilePosixPath = await this.resolveWindowsProfilePosixPath();
    if (!profilePosixPath) {
      console.log(
        "[Voice] stageVoiceScriptInWindowsDir: profilePosixPath is null, aborting",
      );
      return null;
    }

    const targetPosixDir = path.join(profilePosixPath, ".continue-voice");
    console.log(
      "[Voice] stageVoiceScriptInWindowsDir: targetPosixDir:",
      targetPosixDir,
    );
    fs.mkdirSync(targetPosixDir, { recursive: true });
    console.log("[Voice] stageVoiceScriptInWindowsDir: copying transcribe.js");
    fs.copyFileSync(
      sourceScriptPath,
      path.join(targetPosixDir, "transcribe.js"),
    );
    if (fs.existsSync(sourcePackagePath)) {
      console.log("[Voice] stageVoiceScriptInWindowsDir: copying package.json");
      fs.copyFileSync(
        sourcePackagePath,
        path.join(targetPosixDir, "package.json"),
      );
    }
    if (fs.existsSync(sourceConfigPath)) {
      console.log("[Voice] stageVoiceScriptInWindowsDir: copying config.yaml");
      fs.copyFileSync(
        sourceConfigPath,
        path.join(targetPosixDir, "config.yaml"),
      );
    }
    const sourceKillScript = path.join(sourceDir, "kill-voice.ps1");
    if (fs.existsSync(sourceKillScript)) {
      fs.copyFileSync(
        sourceKillScript,
        path.join(targetPosixDir, "kill-voice.ps1"),
      );
    }

    const windowsDir = await this.execFileStdout("wslpath", [
      "-w",
      targetPosixDir,
    ]);
    console.log(
      "[Voice] stageVoiceScriptInWindowsDir: windowsDir result:",
      JSON.stringify(windowsDir),
    );
    return windowsDir;
  }

  private async ensureVoiceRuntimeDependencies(
    windowsScriptDir: string,
  ): Promise<boolean> {
    console.log(
      "[Voice] ensureVoiceRuntimeDependencies: windowsScriptDir:",
      windowsScriptDir,
    );
    const profilePosixPath = await this.resolveWindowsProfilePosixPath();
    if (!profilePosixPath) {
      console.log(
        "[Voice] ensureVoiceRuntimeDependencies: profilePosixPath is null, returning false",
      );
      return false;
    }

    const wsMarker = path.join(
      profilePosixPath,
      ".continue-voice",
      "node_modules",
      "ws",
      "package.json",
    );
    console.log(
      "[Voice] ensureVoiceRuntimeDependencies: wsMarker:",
      wsMarker,
      "exists:",
      fs.existsSync(wsMarker),
    );
    if (fs.existsSync(wsMarker)) {
      console.log(
        "[Voice] ensureVoiceRuntimeDependencies: ws already installed, skipping npm install",
      );
      return true;
    }

    console.log(
      "[Voice] ensureVoiceRuntimeDependencies: running npm install in",
      windowsScriptDir,
    );
    await this.execFileStdout("cmd.exe", [
      "/d",
      "/c",
      `cd /d ${windowsScriptDir} && npm install --silent --no-audit --no-fund`,
    ]);

    const installed = fs.existsSync(wsMarker);
    console.log(
      "[Voice] ensureVoiceRuntimeDependencies: after npm install, wsMarker exists:",
      installed,
    );
    return installed;
  }

  private async startVoiceSelection() {
    console.log("[Voice] startVoiceSelection: called");
    if (this.voiceSelectionProcess) {
      console.log(
        "[Voice] startVoiceSelection: process already running, ignoring",
      );
      return;
    }

    const windowsScriptDir = await this.stageVoiceScriptInWindowsDir();
    if (!windowsScriptDir) {
      console.log(
        "[Voice] startVoiceSelection: stageVoiceScriptInWindowsDir returned null, sending error",
      );
      this.webviewProtocol.send("voiceSelectionStatus", {
        state: "error",
        message: "Unable to prepare voice transcription script.",
      });
      return;
    }

    const depsOk = await this.ensureVoiceRuntimeDependencies(windowsScriptDir);
    if (!depsOk) {
      console.log(
        "[Voice] startVoiceSelection: ensureVoiceRuntimeDependencies returned false, sending error",
      );
      this.webviewProtocol.send("voiceSelectionStatus", {
        state: "error",
        message: "Unable to install voice transcription dependencies (ws).",
      });
      return;
    }

    this.voiceOutputBuffer = "";
    const launchCommand = `cd /d ${windowsScriptDir} && node transcribe.js`;
    console.log(
      "[Voice] startVoiceSelection: spawning cmd.exe with:",
      launchCommand,
    );
    this.voiceSelectionProcess = childProcess.spawn("cmd.exe", [
      "/d",
      "/c",
      launchCommand,
    ]);
    this.voiceSessionStart = Date.now();
    console.log(
      "[Voice][BILLING] Voice session started: pid:",
      this.voiceSelectionProcess.pid,
      "at",
      new Date(this.voiceSessionStart).toISOString(),
    );

    console.log(
      "[Voice] startVoiceSelection: sending 'listening' status to webview",
    );
    this.webviewProtocol.send("voiceSelectionStatus", {
      state: "listening",
    });

    this.voiceSelectionProcess.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      console.log("[Voice] stdout chunk:", JSON.stringify(text));
      this.voiceOutputBuffer += text;
      const lines = this.voiceOutputBuffer.split(/\r?\n|\r/);
      this.voiceOutputBuffer = lines.pop() ?? "";
      for (const line of lines) {
        this.relayVoiceTranscriptLine(line);
      }
      if (this.voiceOutputBuffer.length > 0) {
        console.log(
          "[Voice] stdout buffer remaining (no newline yet):",
          JSON.stringify(this.voiceOutputBuffer),
        );
      }
    });

    this.voiceSelectionProcess.stderr.on("data", (chunk: Buffer) => {
      const message = chunk.toString("utf8").trim();
      console.log("[Voice] stderr chunk:", JSON.stringify(message));
      if (!message) {
        return;
      }
      this.webviewProtocol.send("voiceSelectionStatus", {
        state: "error",
        message,
      });
    });

    this.voiceSelectionProcess.on("error", (error) => {
      console.log("[Voice] process 'error' event:", error.message);
      this.webviewProtocol.send("voiceSelectionStatus", {
        state: "error",
        message: `Voice process failed to start (${windowsScriptDir}): ${error.message}`,
      });
    });

    this.voiceSelectionProcess.on("close", (code, signal) => {
      console.log(
        "[Voice] process 'close' event: code:",
        code,
        "signal:",
        signal,
      );
      this.stopVoiceSelection();
    });
  }

  private stopVoiceSelection() {
    console.log(
      "[Voice] stopVoiceSelection: called, process exists:",
      !!this.voiceSelectionProcess,
    );
    if (this.voiceSelectionProcess) {
      const pid = this.voiceSelectionProcess.pid;
      const sessionDuration = this.voiceSessionStart
        ? ((Date.now() - this.voiceSessionStart) / 1000).toFixed(1)
        : "unknown";
      console.log(
        `[Voice][BILLING] Stopping voice session: pid=${pid}, duration=${sessionDuration}s`,
      );

      // The voice process is spawned via cmd.exe (Windows) even when the
      // extension host runs in WSL. The WSL PID != Windows PID, so taskkill
      // by PID won't work. We use a staged PowerShell script (kill-voice.ps1)
      // that finds node.exe running transcribe.js by command line and kills
      // the entire process tree including ffmpeg.
      if (pid) {
        // 1) Kill WSL-side wrapper first
        try {
          this.voiceSelectionProcess.kill("SIGTERM");
        } catch {}

        // 2) Kill Windows-side via kill-voice.ps1
        try {
          const userProfile = childProcess
            .execFileSync("cmd.exe", ["/d", "/c", "echo %USERPROFILE%"])
            .toString()
            .trim();
          const killScriptWin = `${userProfile}\\.continue-voice\\kill-voice.ps1`;
          childProcess.execSync(
            `powershell.exe -ExecutionPolicy Bypass -File "${killScriptWin}"`,
            { stdio: "pipe", timeout: 10000 },
          );
          console.log(
            `[Voice][BILLING] kill-voice.ps1 executed — transcribe.js process tree killed`,
          );
        } catch (e: any) {
          console.log(`[Voice][BILLING] kill-voice.ps1 failed: ${e.message}`);
        }
      }
      this.voiceSelectionProcess = null;
      this.voiceSessionStart = null;
    }
    this.voiceOutputBuffer = "";
    console.log("[Voice] stopVoiceSelection: sending 'idle' status to webview");
    this.webviewProtocol.send("voiceSelectionStatus", {
      state: "idle",
    });
  }

  private async speakTts(text: string) {
    const config = this.readVoiceConfig();
    const apiKey = config.deepgramApiKey;
    if (!apiKey) {
      console.log("[Voice:TTS] No deepgramApiKey in config, skipping TTS");
      return;
    }

    // Strip markdown for cleaner speech
    const clean = text
      .replace(/```[\s\S]*?```/g, " code snippet omitted ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/#{1,6}\s*/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[-*]\s+/g, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .trim();

    if (!clean) {
      console.log("[Voice:TTS] Nothing to speak after cleanup");
      return;
    }

    // Deepgram TTS has a 2000 char limit; truncate if needed
    const truncated =
      clean.length > 1900 ? clean.slice(0, 1900) + "..." : clean;
    const model = config.deepgramTtsModel || "aura-2-thalia-en";

    console.log(
      "[Voice:TTS] Calling Deepgram TTS, model:",
      model,
      "text length:",
      truncated.length,
    );

    const ttsAbort = new AbortController();
    this.activeFetchControllers.add(ttsAbort);
    const ttsTimeout = setTimeout(() => ttsAbort.abort(), 30_000);
    const ttsStart = Date.now();

    try {
      console.log("[Voice:TTS][BILLING] Deepgram TTS request started");
      const response = await fetch(
        `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}&encoding=mp3`,
        {
          method: "POST",
          headers: {
            Authorization: `Token ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: truncated }),
          signal: ttsAbort.signal,
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        console.log(
          "[Voice:TTS][BILLING] Deepgram TTS error:",
          response.status,
          errText,
          `duration=${((Date.now() - ttsStart) / 1000).toFixed(1)}s`,
        );
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      console.log(
        `[Voice:TTS][BILLING] Got audio: size=${arrayBuffer.byteLength}bytes, chars=${truncated.length}, duration=${((Date.now() - ttsStart) / 1000).toFixed(1)}s`,
      );

      this.webviewProtocol.send("voiceTtsAudio", {
        audioBase64: base64,
        mimeType: "audio/mpeg",
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log(
          "[Voice:TTS][BILLING] TTS request aborted (timeout or dispose)",
        );
      } else {
        console.log("[Voice:TTS] Error:", err.message);
      }
    } finally {
      clearTimeout(ttsTimeout);
      this.activeFetchControllers.delete(ttsAbort);
    }
  }

  // ─── Gaze tracking ───────────────────────────────────────────────

  private openGazePanel() {
    if (this.gazePanel) {
      this.gazePanel.reveal();
      return;
    }

    const extensionUri = this.context.extensionUri;

    // Find webgazer.js from gui/node_modules
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    let webgazerPath: string | null = null;
    for (const folder of workspaceFolders) {
      let dir = folder.uri.fsPath;
      for (let d = 0; d < 6; d++) {
        const candidate = path.join(
          dir,
          "gui",
          "node_modules",
          "webgazer",
          "dist",
          "webgazer.js",
        );
        if (fs.existsSync(candidate)) {
          webgazerPath = candidate;
          break;
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      if (webgazerPath) break;
    }

    this.gazePanel = vscode.window.createWebviewPanel(
      "gazeTracker",
      "Gaze Tracker",
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "media"),
          ...(webgazerPath
            ? [vscode.Uri.file(path.dirname(webgazerPath))]
            : []),
        ],
      },
    );

    // Read HTML template and inject webgazer URI
    const htmlPath = path.join(
      extensionUri.fsPath,
      "media",
      "gazeTracker.html",
    );
    let html = fs.readFileSync(htmlPath, "utf8");

    if (webgazerPath) {
      const webgazerUri = this.gazePanel.webview.asWebviewUri(
        vscode.Uri.file(webgazerPath),
      );
      html = html.replace("WEBGAZER_URI_PLACEHOLDER", webgazerUri.toString());
    }

    this.gazePanel.webview.html = html;
    console.log("[Gaze] Panel opened");

    this.gazePanel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === "gazeReady") {
        console.log("[Gaze] Calibration complete, tracking active");
      } else if (msg.type === "gazeLinger") {
        this.handleGazeLinger(msg.x, msg.y);
      } else if (msg.type === "gazeCoords") {
        // Optional: could use for real-time gaze indicator
      }
    });

    this.gazePanel.onDidDispose(() => {
      console.log("[Gaze] Panel disposed");
      this.gazePanel = null;
    });
  }

  private closeGazePanel() {
    if (this.gazePanel) {
      this.gazePanel.webview.postMessage({ type: "stop" });
      this.gazePanel.dispose();
      this.gazePanel = null;
      console.log("[Gaze] Panel closed");
    }
  }

  private handleGazeLinger(screenX: number, screenY: number) {
    console.log("[Gaze] Linger detected at screen coords:", screenX, screenY);

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      console.log("[Gaze] No active editor");
      return;
    }

    // Map screen Y to approximate editor line using visible range
    const visibleRanges = editor.visibleRanges;
    if (!visibleRanges.length) return;

    const firstVisible = visibleRanges[0].start.line;
    const lastVisible = visibleRanges[visibleRanges.length - 1].end.line;
    const visibleLineCount = lastVisible - firstVisible + 1;

    // Estimate: gaze panel is on the right, editor is on the left
    // Screen Y maps roughly to the editor area. We use a proportion-based estimate.
    // This is approximate — WebGazer gives screen-relative coords.
    // The editor typically occupies the left ~60% of screen height from ~top bar to bottom.
    const editorTopPx = 30; // approximate title bar height
    const editorBottomPx =
      (typeof screen !== "undefined" ? screen.availHeight : 900) - 30;
    const editorHeightPx = editorBottomPx - editorTopPx;

    const fractionY = Math.max(
      0,
      Math.min(1, (screenY - editorTopPx) / editorHeightPx),
    );
    const estimatedLine =
      firstVisible + Math.round(fractionY * visibleLineCount);
    const clampedLine = Math.max(
      firstVisible,
      Math.min(lastVisible, estimatedLine),
    );

    console.log(
      "[Gaze] Estimated editor line:",
      clampedLine,
      "(visible:",
      firstVisible,
      "-",
      lastVisible,
      ")",
    );

    // Find which function contains this line
    const doc = editor.document;
    const text = doc.getText();
    const lines = text.split(/\r?\n/);

    // Parse functions: look for function-like patterns and track brace depth
    const functions: { name: string; startLine: number; endLine: number }[] =
      [];
    const funcPattern =
      /(?:function\s+(\w+)|(\w+)\s*\(.*\)\s*\{|(\w+)\s*=\s*(?:function|\(.*\)\s*=>))/;
    let currentFunc: {
      name: string;
      startLine: number;
      braceDepth: number;
    } | null = null;

    for (let i = 0; i < lines.length; i++) {
      if (!currentFunc) {
        const match = lines[i].match(funcPattern);
        if (match) {
          const name = match[1] || match[2] || match[3] || "anonymous";
          currentFunc = { name, startLine: i, braceDepth: 0 };
        }
      }
      if (currentFunc) {
        for (const ch of lines[i]) {
          if (ch === "{") currentFunc.braceDepth++;
          if (ch === "}") currentFunc.braceDepth--;
        }
        if (currentFunc.braceDepth <= 0 && lines[i].includes("}")) {
          functions.push({
            name: currentFunc.name,
            startLine: currentFunc.startLine,
            endLine: i,
          });
          currentFunc = null;
        }
      }
    }

    console.log(
      "[Gaze] Found",
      functions.length,
      "functions:",
      functions
        .map((f) => `${f.name}(${f.startLine + 1}-${f.endLine + 1})`)
        .join(", "),
    );

    // Find which function the gaze line falls in
    const gazeFunc = functions.find(
      (f) => clampedLine >= f.startLine && clampedLine <= f.endLine,
    );

    if (gazeFunc) {
      console.log(
        "[Gaze] Selecting function:",
        gazeFunc.name,
        "lines",
        gazeFunc.startLine + 1,
        "-",
        gazeFunc.endLine + 1,
      );

      // Avoid re-selecting the same function repeatedly
      const selKey = `${gazeFunc.startLine}-${gazeFunc.endLine}`;
      if ((this as any)._lastGazeSelection === selKey) {
        console.log("[Gaze] Same function already selected, skipping");
        return;
      }
      (this as any)._lastGazeSelection = selKey;

      const range = new vscode.Range(
        new vscode.Position(gazeFunc.startLine, 0),
        new vscode.Position(
          gazeFunc.endLine,
          lines[gazeFunc.endLine]?.length ?? 0,
        ),
      );
      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(
        range,
        vscode.TextEditorRevealType.InCenterIfOutsideViewport,
      );
    } else {
      console.log("[Gaze] No function at line", clampedLine);
    }
  }
}
