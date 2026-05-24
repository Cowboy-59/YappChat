# YappChat Avatar Library

16×16 pixel art SVG avatars for the AI Assistant. All are CC0 or MIT — no attribution required, safe for commercial use.

## Included (12 avatars)

| File | Name | Source | License |
| --- | --- | --- | --- |
| `molty.svg` | Molty (Lobster) | [OpenClaw](https://github.com/openclaw/openclaw) | MIT |
| `cat.svg` | Cat | YappChat original | CC0 |
| `dog.svg` | Dog | YappChat original | CC0 |
| `fox.svg` | Fox | YappChat original | CC0 |
| `rabbit.svg` | Rabbit | YappChat original | CC0 |
| `penguin.svg` | Penguin | YappChat original | CC0 |
| `panda.svg` | Panda | YappChat original | CC0 |
| `parrot.svg` | Parrot | YappChat original | CC0 |
| `monkey.svg` | Monkey | YappChat original | CC0 |
| `elephant.svg` | Elephant | YappChat original | CC0 |
| `pig.svg` | Pig | YappChat original | CC0 |
| `frog.svg` | Frog | YappChat original | CC0 |
| `prezTrump.svg` | Prez Trump | YappChat original | CC0 |
| `biden.svg` | Biden | YappChat original | CC0 |

## Adding more avatars

The **Kenney Animal Pack Redux** has 30 animals as free CC0 SVGs:

1. Download the pack from [kenney.nl/assets/animal-pack-redux](https://kenney.nl/assets/animal-pack-redux) (free)
2. Copy the SVG files you want into this directory
3. Register them in `registry.ts`

Available animals not yet included: Bear, Bird, Bull, Chick, Cow, Crocodile, Duck, Giraffe, Gorilla, Hippo, Horse, Koala, Lion, Owl, Rhino, Sheep, Snake, Tiger, Toucan, Wolf (and variants)

## Format

All avatars use the same format:

- `viewBox="0 0 16 16"` — 16×16 pixel art grid
- `width="64" height="64"` — rendered at 64×64px (scales with CSS)
- `<rect>` elements for each pixel — no paths, no gradients
- Transparent background

## Animation

State animations are applied via CSS classes defined in `src/ui/styles/avatar-animations.css`.
The `AvatarDisplay` React component handles rendering — import from `src/ui/components/avatar/AvatarDisplay.tsx`.
