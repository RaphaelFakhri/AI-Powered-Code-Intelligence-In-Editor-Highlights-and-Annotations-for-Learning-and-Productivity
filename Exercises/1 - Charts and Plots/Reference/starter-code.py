import os
import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

_dir = os.path.dirname(os.path.abspath(__file__))

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

sns.set_theme(style="whitegrid")

fig, axes = plt.subplots(4, 1, figsize=(8, 24))

palette = sns.color_palette("muted", n_colors=len(school_names))

for i, subject in enumerate(subjects):
    ax = axes[i]
    subset = df[df["Subject"] == subject]

    sns.violinplot(data=subset, x="School", y="Score",
                   hue="School", palette=palette, inner=None,
                   orient="v", legend=False, ax=ax)

    ax.set_title(subject, fontsize=14, fontweight="bold")
    ax.set_xlabel("School")
    ax.set_ylabel("Score")
    ax.set_ylim(0, 110)

sns.despine(left=False, bottom=False)

fig.suptitle("Student Exam Score Distributions by School",
             fontsize=18, fontweight="bold", y=1.01)
plt.tight_layout()
_out = os.path.join(_dir, "output.png")
plt.savefig(_out, dpi=150, bbox_inches="tight")
os.system(f'code "{_out}"')
