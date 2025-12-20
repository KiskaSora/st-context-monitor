# Context Monitor

Real-time context usage indicator that shows exactly how many tokens are being sent to your AI model, including system prompts, character cards, and all hidden formatting 〜(￣▽￣〜)

## Features

- Shows actual prompt size sent to API (includes system prompts, character cards, etc.)
- Real-time updates during generation
- Customizable appearance (position, opacity, scale, color)
- Optional custom context limit

# WARNING!!1! 
its pure vibecoding (ty, gemini 3 pro) (ノへ￣、)
it works (somehow lmao), but don't expect enterprise-grade code quality.

## Installation
1. Open SillyTavern
2. Click **Extensions** → **Install Extension**
3. Paste this URL: https://github.com/iammaemi/st-context-monitor
4. Click **Install**
5. **Refresh** the page

After installation, you'll see a token counter in the corner of your screen:

7189/32000

- **Left number** (7189): Current tokens being sent to API
- **Right number** (32000): Your maximum context limit

## ⚙️ Configuration
### Basic Settings
- **Enable Monitor**: Toggle the indicator on/off
- **Position**: Choose which corner to display in (top-right, top-left, bottom-right, bottom-left)
- **Opacity**: Adjust transparency (10% to 100%)
- **Scale**: Make it bigger or smaller (0.5x to 1.5x)
- **Background**: Pick any color you like

**How to set Max Context Limit:**

1. Open **Extensions** → **Context Monitor**
2. Check ✅ **"Use custom max context"**
3. Enter your desired limit (e.g., `32000`, `64000`, `128000`)
4. The indicator now shows `current/YOUR_LIMIT`

## 📝 License
do whatever you want with it ƪ ( ˘ ⌣ ˘ ) ʃ

