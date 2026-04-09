import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

# Exam score data for 4 subjects across 5 schools
subjects = ["Mathematics", "Physics", "Literature", "History"]

np.random.seed(42)
school_names = ["Northview", "Southgate", "Eastwood", "Westfield", "Central"]

scores_data = {
    "Mathematics": [
        np.random.normal(72, 12, 30),
        np.random.normal(65, 15, 30),
        np.random.normal(80, 8, 30),
        np.random.normal(58, 18, 30),
        np.random.normal(75, 10, 30),
    ],
    "Physics": [
        np.random.normal(68, 14, 30),
        np.random.normal(70, 10, 30),
        np.random.normal(62, 16, 30),
        np.random.normal(74, 9, 30),
        np.random.normal(66, 13, 30),
    ],
    "Literature": [
        np.random.normal(78, 11, 30),
        np.random.normal(82, 7, 30),
        np.random.normal(69, 14, 30),
        np.random.normal(76, 10, 30),
        np.random.normal(71, 12, 30),
    ],
    "History": [
        np.random.normal(70, 13, 30),
        np.random.normal(73, 11, 30),
        np.random.normal(67, 15, 30),
        np.random.normal(80, 8, 30),
        np.random.normal(64, 17, 30),
    ],
}

# Build DataFrames for each subject
dfs = []
for subject in subjects:
    for j, school in enumerate(school_names):
        scores = np.clip(scores_data[subject][j], 0, 100).astype(int)
        temp = pd.DataFrame({
            "Score": scores,
            "School": school,
            "Subject": subject
        })
        dfs.append(temp)

df = pd.concat(dfs, ignore_index=True)

# --- Plotting ---
sns.set_theme(style="whitegrid")

# SOLVED Subtask 1: 2x2 grid instead of 4x1
fig, axes = plt.subplots(2, 2, figsize=(14, 12))

palette = sns.color_palette("muted", n_colors=len(school_names))

for i, subject in enumerate(subjects):
    # SOLVED Subtask 1: 2D indexing
    ax = axes[i // 2, i % 2]
    subset = df[df["Subject"] == subject]

    # SOLVED Subtask 2: inner="box" instead of inner=None
    sns.violinplot(data=subset, x="School", y="Score",
                   hue="School", palette=palette, inner="box",
                   orient="v", legend=False, ax=ax)

    # SOLVED Subtask 3: overlay strip plot
    sns.stripplot(data=subset, x="School", y="Score",
                  color="black", size=3, alpha=0.4,
                  jitter=True, ax=ax)

    ax.set_title(subject, fontsize=14, fontweight="bold")
    ax.set_xlabel("School")
    ax.set_ylabel("Score")
    ax.set_ylim(0, 110)

# SOLVED Subtask 4: remove left and bottom spines
sns.despine(left=True, bottom=True)

fig.suptitle("Student Exam Score Distributions by School",
             fontsize=18, fontweight="bold", y=1.01)
plt.tight_layout()
plt.savefig("seaborn_goal_output.png", dpi=150, bbox_inches="tight")
plt.show()
