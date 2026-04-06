# Pillow (PIL)

In this task, we want to create a 2x2 grid of team profile cards, each showing the team name, member count (as dots), and status. The cards should be crisp, right-side-up, and neatly arranged.

You have found code that creates a pretty similar output (see Start Output), but you want to create something like the Goal Output.

## Start Output

_(Run `pillow_task.py` to see the start output: four cards stacked in a single column, upside-down, blurry, with thick dark borders.)_

## Goal Output

_(Run `pillow_goal.py` to see the goal output: four cards arranged in a 2x2 grid, right-side-up, sharp/crisp, with thin borders.)_

---

## Subtasks

To create the goal output, you have to do the following tasks.

### Subtask 1:

**Display the four cards in a 2 x 2 grid.**

Currently the cards are stacked vertically in a single column (4 rows, 1 column). Arrange them into a 2x2 grid layout.

| Current                                     | Goal                                     |
| ------------------------------------------- | ---------------------------------------- |
| 4 cards in a tall column (ncols=1, nrows=4) | 4 cards in a 2x2 grid (ncols=2, nrows=2) |

---

### Subtask 2:

**Reduce the border thickness around each card.**

The dark border around each card is currently 8 pixels wide, making it look heavy. Reduce it to 2 pixels for a cleaner look.

| Current                        | Goal                          |
| ------------------------------ | ----------------------------- |
| `border_w = 8` (thick borders) | `border_w = 2` (thin borders) |

---

### Subtask 3:

**Fix the card orientation.**

Each card is currently rotated 180 degrees (upside-down). The team names and status bars appear at the bottom/top incorrectly. Remove the rotation so cards display right-side-up.

| Current                          | Goal                        |
| -------------------------------- | --------------------------- |
| `card.rotate(180)` (upside-down) | No rotation (right-side-up) |

---

### Subtask 4:

**Remove the blur effect from the final image.**

A Gaussian blur is applied to the entire canvas, making all text and shapes fuzzy. Remove it so the output is crisp and readable.

| Current                                             | Goal              |
| --------------------------------------------------- | ----------------- |
| `canvas.filter(ImageFilter.GaussianBlur(radius=3))` | No filter applied |
