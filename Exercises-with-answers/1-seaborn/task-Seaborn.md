# Seaborn

In this task, we want to create a grid of violin plots that display exam score distributions for four subjects (Mathematics, Physics, Literature, History) across five schools.

You have found code that creates a pretty similar output (see Start Output), but you want to create something like the Goal Output.

## Start Output

_(Run `seaborn_task.py` to see the start output: four violin plots stacked vertically in a single column, with plain violins, no individual data points, and visible axis spines.)_

## Goal Output

_(The goal output shows: four violin plots arranged in a 2x2 grid, each violin contains an inner box plot, individual student scores are overlaid as dots, and the left/bottom axis spines are removed for a cleaner look.)_

---

## Subtasks

To create the goal output, you have to do the following tasks.

### Subtask 1:

**Display the four plots in a 2 x 2 grid.**

Currently the plots are displayed in a single column (4 rows, 1 column). Arrange them into a 2x2 grid layout.

| Current                          | Goal                  |
| -------------------------------- | --------------------- |
| 4 plots stacked vertically (4x1) | 4 plots in a 2x2 grid |

---

### Subtask 2:

**Add inner box plots inside each violin.**

Currently the violins are hollow (no inner summary). Add a box plot inside each violin to show the median, quartiles, and whiskers.

| Current                       | Goal                          |
| ----------------------------- | ----------------------------- |
| Hollow violins (`inner=None`) | Violins with box plots inside |

---

### Subtask 3:

**Overlay individual data points on the violins.**

Add a strip plot (jittered dots) on top of the violins so that individual student scores are visible.

| Current            | Goal                                  |
| ------------------ | ------------------------------------- |
| Only violin shapes | Violin shapes + individual score dots |

---

### Subtask 4:

**Remove the left and bottom axis spines.**

Currently all axis spines (borders) are visible. Remove the left and bottom spines for a cleaner appearance.

| Current            | Goal                           |
| ------------------ | ------------------------------ |
| All spines visible | Left and bottom spines removed |
