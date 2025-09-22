# Project Manager

A modern, collaborative project management application built with Next.js 15, Supabase, and Tailwind CSS. Manage workspaces, projects, tasks, and team collaboration with real-time updates and customizable workflows.

## 🚀 Features

### 🏢 Workspace Management
- **Multi-workspace support** - Create and manage multiple workspaces
- **Private & Shared workspaces** - Control visibility and collaboration
- **Role-based access control** - Owner, Admin, Manager, Member, and Limited roles
- **Workspace settings** - Customize workflows, tags, and member management
- **Activity logs** - Track all workspace activities with filtering

### 📋 Project Management
- **Project creation & organization** - Create projects within workspaces
- **Project archiving** - Archive completed projects
- **Client management** - Associate projects with clients
- **Project status tracking** - Dynamic status based on task progress
- **Completion tracking** - Visual progress bars and completion percentages

### ✅ Task Management
- **Kanban & List views** - Switch between visual and list-based task management
- **Custom workflows** - Define 3-6 workflow steps with custom colors
- **Task tagging** - Organize tasks with color-coded tags
- **Real-time updates** - Live synchronization across all users
- **Task completion** - Track task progress through workflow stages

### 📝 Content Management
- **Notes system** - Create and manage project notes with priorities
- **File management** - Upload and organize project files
- **Milestones** - Set and track project milestones
- **Automatic cleanup** - Remove empty milestones automatically

### 👥 Team Collaboration
- **Member management** - Invite and manage workspace and project members
- **Role-based permissions** - Granular access control
- **Real-time collaboration** - Live updates across all team members
- **Activity tracking** - Monitor team activities and changes

### 🎨 User Experience
- **Responsive design** - Works seamlessly on desktop and mobile
- **Dark theme** - Modern dark UI with green accents
- **Smooth animations** - Framer Motion powered transitions
- **Intuitive navigation** - Clean, organized interface
- **Auto-save** - Changes are saved automatically

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling
- **Framer Motion** - Smooth animations and transitions
- **Lucide React** - Beautiful icons

### Backend & Database
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Real-time subscriptions
  - Row Level Security (RLS)
  - Authentication
  - File storage

### Development Tools
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixes


## 🏗️ Architecture

### Backend
- **Supabase** - PostgreSQL database with real-time subscriptions
- **Row Level Security (RLS)** - Secure data access control
- **Authentication** - Email/password with verification
- **File Storage** - Integrated file upload and management

### Frontend
- **Next.js 15** - App Router with server and client components
- **Real-time Updates** - Live synchronization across all users
- **Responsive Design** - Mobile-first approach with Tailwind CSS
- **State Management** - React hooks with context providers

## 🔐 Authentication & Security

### Authentication Flow
- **Email/Password authentication** via Supabase Auth
- **Email verification** required for new accounts
- **Automatic profile creation** on first login
- **Session management** with automatic refresh

### Security Features
- **Row Level Security (RLS)** on all database tables
- **Role-based access control** at workspace and project levels
- **Secure API routes** with server-side validation
- **CSRF protection** via Next.js built-in features

### Permission System

#### Workspace Roles
- **Owner**: Full control, can manage all members and settings
- **Admin**: Can manage members (except owners) and most settings
- **Manager**: Can invite members and manage projects
- **Member**: Can work on projects, limited settings access
- **Limited**: Read-only access to projects

#### Project Roles
- **Owner**: Full project control
- **Admin**: Can manage project members and settings
- **Write**: Can create and edit content
- **Read**: Read-only access

## 🎯 Usage Guide

### Getting Started

1. **Sign Up** - Create an account with email verification
2. **Create Workspace** - Set up your first workspace (private or shared)
3. **Customize Workflow** - Define your task workflow (3-6 steps)
4. **Add Tags** - Create custom tags for task organization
5. **Create Projects** - Start your first project
6. **Invite Members** - Add team members to your workspace

### Managing Projects

1. **Create Project** - Add name, description, and assign client
2. **Add Tasks** - Create tasks with tags and assign to members
3. **Track Progress** - Use Kanban or List view to manage tasks
4. **Set Milestones** - Define project milestones and track completion
5. **Add Notes** - Document important information
6. **Upload Files** - Store project-related documents

### Team Collaboration

1. **Invite Members** - Send email invitations to team members
2. **Assign Roles** - Set appropriate permissions for each member
3. **Project Assignment** - Add members to specific projects
4. **Monitor Activity** - View activity logs and team progress
5. **Real-time Updates** - See changes as they happen


## 🔧 Development

### Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── dashboard/         # Dashboard pages
│   ├── login/            # Authentication pages
│   ├── signup/           # Registration pages
│   ├── workspace/        # Workspace pages
│   ├── lib/              # Utilities and configurations
│   └── globals.css       # Global styles
├── components/           # Reusable components
└── middleware.ts         # Next.js middleware
```

### Key Components

- **DashboardShell** - Main dashboard layout
- **WorkspaceShell** - Workspace-specific layout
- **TodosComponent** - Task management with Kanban/List views
- **MemberManagement** - Team member management
- **WorkflowSettings** - Workflow and tag configuration
- **FilesComponent** - File upload and management
- **NotesComponent** - Note-taking system
- **MilestonesComponent** - Milestone tracking

### Real-time Features

The app uses Supabase real-time subscriptions for:
- **Task updates** - Live task status changes
- **Member changes** - Real-time member additions/removals
- **Project updates** - Live project modifications
- **File uploads** - Real-time file management
- **Notes changes** - Live note updates

## 💼 Portfolio Project

This is a portfolio project demonstrating full-stack development skills including:

- **Frontend Development** - React, Next.js, TypeScript, Tailwind CSS
- **Backend Development** - Supabase, PostgreSQL, Real-time subscriptions
- **UI/UX Design** - Responsive design, animations, user experience
- **State Management** - React hooks, context providers, real-time updates
- **Authentication** - Secure user management and role-based access
- **Database Design** - Relational database with proper relationships
- **Real-time Features** - Live collaboration and updates
- **File Management** - Upload, storage, and organization
- **Project Architecture** - Scalable, maintainable code structure

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation
- Review the code examples

## 🔮 Roadmap

### Planned Features
- **Task assignment** - Assign tasks to project members
- **Tasks into dashboard** - Assigned tasks into dashboard view
- **Time tracking** - Track time spent on tasks
- **Calendar integration** - Sync with Google Calendar
- **Notifications** - Email and push notifications
- **Invitations** - Email invitations to collaboration
- **AI Assistant** - AI set up new project, with tasks and milestones

### Features in consideration
- **Advanced reporting** - Detailed analytics and reports
- **Mobile app** - Cross-platform mobile application
- **API access** - RESTful API for integrations
- **Templates** - Project and workflow templates
- **Advanced permissions** - More granular access control

---

Built using Next.js, Supabase, and Tailwind CSS# Updated README for GitHub cache refresh
