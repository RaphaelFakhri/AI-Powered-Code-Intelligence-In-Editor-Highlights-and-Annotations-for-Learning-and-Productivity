from PIL import Image, ImageDraw, ImageFilter, ImageOps

# Team data
teams = [
    {"name": "Alpha Team", "members": 12, "color": (33, 150, 243)},
    {"name": "Beta Team",  "members": 8,  "color": (233, 30, 99)},
    {"name": "Gamma Team", "members": 15, "color": (76, 175, 80)},
    {"name": "Delta Team", "members": 6,  "color": (255, 152, 0)},
]

card_w, card_h = 300, 220
margin = 20
# SOLVED Subtask 2: border_w = 2 instead of 8
border_w = 2

# SOLVED Subtask 1: 2x2 grid instead of 1x4
ncols = 2
nrows = 2

total_card_w = card_w + 2 * border_w
total_card_h = card_h + 2 * border_w

canvas_w = ncols * total_card_w + (ncols + 1) * margin
canvas_h = nrows * total_card_h + (nrows + 1) * margin

canvas = Image.new("RGB", (canvas_w, canvas_h), (240, 240, 240))

for i, team in enumerate(teams):
    # --- Create the card ---
    card = Image.new("RGB", (card_w, card_h), team["color"])
    draw = ImageDraw.Draw(card)

    # Dark header bar with team name
    draw.rectangle([0, 0, card_w, 50], fill=(51, 51, 51))
    draw.text((10, 18), team["name"], fill="white")

    # Draw member dots (visual representation of team size)
    for m in range(team["members"]):
        cx = 30 + (m % 6) * 45
        cy = 80 + (m // 6) * 45
        draw.ellipse([cx - 12, cy - 12, cx + 12, cy + 12],
                     fill="white", outline=(51, 51, 51), width=2)

    # Status bar at bottom
    draw.rectangle([0, card_h - 30, card_w, card_h], fill=(51, 51, 51))
    status = "Active" if team["members"] > 7 else "Small"
    draw.text((10, card_h - 25), f"Status: {status}", fill="white")

    # Add border around the card
    card = ImageOps.expand(card, border=border_w, fill=(51, 51, 51))

    # SOLVED Subtask 3: no rotation (was rotate(180))

    # Calculate grid position
    row = i // ncols
    col = i % ncols
    x = margin + col * (total_card_w + margin)
    y = margin + row * (total_card_h + margin)
    canvas.paste(card, (x, y))

# SOLVED Subtask 4: no blur applied (removed GaussianBlur)

canvas.save("pillow_goal_output.png")
print(f"Saved pillow_goal_output.png ({canvas.size[0]}x{canvas.size[1]})")
