# LaboratoryOS Design Specification

**Last Updated**: 2026-02-09  
**Git Tag**: `v1.0-final`  
**Reference Screenshot**: Telegram message from Selden (2026-02-09 23:27 PST)

## Core Design Principles

### Color Palette
- **Background**: Pure black `#000`
- **Cards**: Very dark `#0a0a0a` with `#1a1a1a` border
- **Text Primary**: White `#fff`
- **Text Secondary**: Gray `#888`
- **Text Tertiary**: Dark gray `#666`
- **Hover Background**: Slightly lighter `#0f0f0f`
- **Borders**: Subtle dark `#1a1a1a`, hover `#333`

### Typography
- **Font**: Apple system fonts (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto)
- **Page Title**: 28px, bold
- **Card Title**: 14px, semibold, white
- **Card Description**: 12px, regular, #888
- **Column Headers**: 11px, bold, uppercase, #666
- **Sidebar Logo**: 16px, bold

### Layout
- **Sidebar**: 200px width, black background, subtle border-right
- **Main Content**: Flexible, 32px-40px padding
- **Kanban Columns**: 5 columns equal width with 20px gap
  1. Not Started
  2. Pending Input
  3. In Progress
  4. Ready to Review
  5. Completed

### Card Design
- **Style**: Clean, minimal, NO glassmorphism
- **Background**: Solid #0a0a0a (not transparent)
- **Border**: 1px solid #1a1a1a
- **Border Radius**: 10px
- **Padding**: 16px
- **Hover**: Lighter background (#0f0f0f), border (#333), translateY(-2px)
- **No backdrop-filter**: Cards are solid, not glass

### Interactive Elements
- **All cards clickable**: Opens modal with full details
- **Modal**: Solid dark (#0a0a0a), centered, max-width 700px
- **Modal actions**: Close, Delete buttons at bottom
- **Transitions**: Smooth 0.2s ease for all hovers

### Navigation
- **Sidebar items**: 
  - Inactive: #888 text, transparent background
  - Hover: #111 background, #fff text
  - Active: #1a1a1a background, #fff text
- **Icons**: 16px, stroke-width: 2, opacity varies by state

### System Status Indicator
- **Position**: Bottom of sidebar
- **Color**: Bright green #0f0
- **Animation**: Pulsing dot (2s ease-in-out)
- **Text**: Uppercase "ONLINE", 10px

## What NOT To Do

❌ **NO glassmorphism effects** (backdrop-filter, rgba backgrounds with blur)  
❌ **NO animated gradients** in background  
❌ **NO heavy blur effects**  
❌ **NO translucent cards** - they should be solid  
❌ **NO overly colorful accents** - keep it minimal  

## Data Sources

- **Tasks**: `/data/tasks.json` (14 tasks across 5 columns)
- **Settings**: `/data/settings.json` (interface + cadence configs)
- **Cron Jobs**: `/api/cron/jobs` (from `~/.openclaw/cron/jobs.json`)

## File Structure

```
openclaw-dashboard/
├── public/
│   └── index.html (single-file app)
├── data/
│   ├── tasks.json
│   └── settings.json
├── server.js (Express + basic auth)
├── package.json
└── DESIGN.md (this file)
```

## Deployment

**Platform**: Railway  
**URL**: https://openclaw-mission-control-production.up.railway.app  
**Auth**: Basic auth (admin/selden)  
**Environment**: 
- `PORT`: Auto-assigned by Railway
- `HOME`: /root (for cron file access)

## Recovery

If design gets corrupted:
```bash
git checkout v1.0-final
git push origin main --force
```

Or reference this commit: `f082324`
