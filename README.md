# Twixt Commentator

A website for analyzing and commenting on size 24 TwixtPP games from the popular board game site Little Golem.

Hosted at [twixt-commentator.duckdns.org](http://twixt-commentator.duckdns.org/)

## History

In 2007, this was a project for me to learn Ruby on Rails. It continued getting used, so I continued hosting and maintaining it.

In 2026, this became a project for me to play with vibe coding. I used AI to translate it to more popular, modern, and maintainable technologies, with the hope of future contributions from both humans and AI.

## Current Tech Stack

- **Language:** ES6 to ES2022 JavaScript
- **Runtime:** Node.js v24
- **Framework:** Express.js
- **Templating:** EJS with ejs-mate
- **Database:** MySQL (via Sequelize ORM)

## Contributing

Contributions are welcome! Please open an issue or pull request on GitHub.

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| [Node.js](https://nodejs.org/) | **v24** | Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to manage versions |
| [MySQL](https://dev.mysql.com/downloads/) | **v8+** | v8.0 or v9.x both work fine |


### 1. Clone & Install

```bash
git clone https://github.com/ahensel/twixt-commentator.git
cd twixt-commentator
npm ci
```

### 2. Environment Variables (optional)

The app reads from a `.env` file in the project root (excluded from version control). You can create one from the example:

```bash
cp .env.example .env
```

If `.env` doesn't exist, or a variable is not defined in it, Commentator proceeds with defaults.

For example, the database credentials for development are hard-coded in `config/config.js` (root user, no password, database `twixt_development`) if they are not present in `.env`.

### 3. Create the Database

In a MySQL shell or client, create the development database:

```sql
CREATE DATABASE twixt_development CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Run Database Migrations

Migrations live in the `migrations/` directory and are managed by Sequelize CLI.
This creates all tables in the correct order:

```bash
npx sequelize-cli db:migrate
```

To undo all migrations (drops all tables):

```bash
npx sequelize-cli db:migrate:undo:all
```

### 5. Run the Dev Server

First, start MySQL if it is not already running. Then start the Node server:

```bash
npm run dev
```

This starts the server with `nodemon` (auto-restarts on file changes). Open [http://localhost:3000](http://localhost:3000) in your browser.

### Project Layout

```
twixt-commentator/
├── config/          # Database connection & Sequelize CLI config
├── lib/             # Shared helpers (applicationHelper, etc.)
├── migrations/      # Sequelize migrations (run with sequelize-cli db:migrate)
├── models/          # Sequelize model definitions (Game, Comment, User)
├── public/          # Static assets & client-side JS (universal module pattern)
├── routes/          # Express route handlers
├── views/           # EJS templates with ejs-mate layout inheritance
├── server.js        # App entry point
└── .env             # Environment secrets — never commit this file
```

## Copyright

© 2026 Alan Hensel. All rights reserved. This code is provided for educational purposes and community contribution. You may view and fork this repository as permitted by GitHub's Terms of Service, but no license is granted for hosting, redistribution, or commercial use.
