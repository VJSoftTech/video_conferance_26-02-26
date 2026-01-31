# பேசு தமிழ் - Video Conferencing Application

A professional video conferencing web application with real-time video/audio calls, screen sharing, chat, and collaborative features.

## Features

- **Video/Audio Calls**: Real-time HD video and audio streaming using LiveKit
- **Screen Sharing**: Share your screen with other participants
- **Whiteboard**: Collaborative drawing board with tldraw integration
- **Meeting Management**: Create, schedule, and manage meetings
- **Waiting Room**: Optional waiting room with host approval
- **Host Controls**: Mute all, disable cameras, lock room, end meeting
- **In-Meeting Chat**: Real-time text chat during meetings
- **Emoji Reactions**: Send emoji reactions visible in participants list
- **Hand Raise**: Visual hand raise feature with notifications
- **Team Chat**: Channels and direct messages
- **Meeting Scheduler**: Calendar integration for planning meetings
- **Notes, Tasks, Docs**: Organize meeting-related content
- **Email Invites**: Send meeting invites via custom SMTP
- **Dark/Light Mode**: Theme toggle support
- **Mobile Responsive**: Full mobile support with touch-friendly UI

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui
- LiveKit Client SDK
- Socket.IO Client
- wouter (routing)
- TanStack React Query

### Backend
- Node.js + Express
- TypeScript
- Socket.IO
- LiveKit Server SDK
- Drizzle ORM
- PostgreSQL

## Prerequisites

- Node.js 20+
- PostgreSQL database
- LiveKit Cloud account (or self-hosted LiveKit server)

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# LiveKit Configuration
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
VITE_LIVEKIT_URL=wss://your-livekit-server.livekit.cloud

# Session
SESSION_SECRET=your_session_secret_key

# Optional: Custom domain for email invites
APP_DOMAIN=yourdomain.com
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd meetspace
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the database**
   ```bash
   npm run db:push
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   Open http://localhost:5000 in your browser

## Production Build

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm start
   ```

## Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── ui/         # shadcn/ui components
│   │   │   ├── meeting/    # Meeting-specific components
│   │   │   └── dashboard/  # Dashboard components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility functions
│   │   └── pages/          # Page components
│   ├── public/             # Static assets (favicon, logo)
│   └── index.html          # HTML entry point
├── server/                 # Backend Express application
│   ├── index.ts            # Server entry point
│   ├── routes.ts           # API routes + Socket.IO handlers
│   ├── livekit.ts          # LiveKit integration
│   ├── email.ts            # Email sending service
│   └── db.ts               # Database connection
├── shared/                 # Shared types and schemas
│   └── schema.ts           # Drizzle schemas + Zod validation
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite configuration
├── tailwind.config.ts      # Tailwind CSS configuration
└── drizzle.config.ts       # Drizzle ORM configuration
```

## Database Schema

The application uses PostgreSQL with the following main tables:
- `users` - User accounts
- `meetings` - Meeting records with settings
- `meeting_participants` - Participant tracking
- `meeting_invites` - Email invites sent
- `notes` - Meeting notes
- `tasks` - Action items
- `docs` - Meeting documents
- `contacts` - Contact management
- `smtp_settings` - Email configuration
- `whiteboards` - Collaborative whiteboard data

## API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/user` - Get current user

### Meetings
- `GET /api/meetings` - List all meetings
- `POST /api/meetings` - Create new meeting
- `GET /api/meetings/:roomId` - Get meeting details
- `POST /api/meetings/:roomId/join` - Join a meeting
- `POST /api/meetings/:roomId/end` - End meeting for all

### LiveKit
- `GET /api/livekit/token` - Generate LiveKit token
- `POST /api/livekit/mute` - Mute participant (host only)

## LiveKit Setup

1. Create an account at [LiveKit Cloud](https://cloud.livekit.io)
2. Create a new project
3. Copy the API Key, API Secret, and WebSocket URL
4. Add them to your environment variables

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run db:push` - Push database schema changes
- `npm run check` - TypeScript type checking

## License

MIT License
