![Artifax](frontend/src/assets/ReadmeImg/Artifax.png)

### Table Of Contents
- [Overview](#overview)
- [Installation](#installation)
- [Usage Guide](#usage-guide)
- [Additional Mockups](#additional-mockups)
- [Running locally](#running-locally)
- [Test Coverage](#test-coverage)
- [Technologies used](#technologies-used)
- [Acknowledgements](#acknowledgements)
## Overview

The purpose of this project report is to present the completed application for the simple and highly reliable inventory management system, Artifax. Developed to avoid unnecessary complication, the system provides a direct approach to tracking internal warehouse operations focusing entirely on internal warehouse components rather than external factors.

The core objective of the system is to deliver a highly scalable backend architecture capable of managing inventory quantities across at least two distinct locations. It enables the tracking of base materials and crafted items, manages production timelines and facilitates structured role-based access control. The system's development was guided by a distinct set of operational needs and analytical wants outlined during initial consultations.


## Installation

<table>
<tr>


### Step 1:
Go to the [latest Artifax release](https://github.com/MarioOjo/Artifax/releases/latest) on GitHub.

### Step 2:
Download the **`Artifax-<version>-Setup.exe`** asset and run it. Artifax installs, adds Start-menu and desktop shortcuts, and opens.

### Step 3:
The installer is not code-signed, so Windows SmartScreen may show a warning. Choose **More info → Run anyway**.

### Step 4:
Sign in with an account created by an administrator, then set up two-factor authentication with an authenticator app. The API runs on a free tier that sleeps when idle, so the first sign-in after a quiet spell can take up to a minute.

> This repository continues the original team project. See [Portfolio changes](docs/PORTFOLIO-CHANGES.md) for everything changed since the team's final version.


</tr>
</table>
   
## Usage Guide

<table width="100%">
  <tr>
    <td width="50%" align="center">
      <img src="frontend/src/assets/ReadmeImg/Dash.png" alt="Dashboard">
    </td>
    <td width="50%">
      <h3>Dashboard</h3>
      <p>The dashboard provides users with a simplified overview of the inventory, featuring clear labels for low-stock alerts. It also displays currently active jobs and tracks orders waiting in the queue for efficient monitoring.</p>
    </td>
  </tr>

  <tr>
    <td width="50%">
      <h3>Inventory</h3>
      <p>The inventory screen displays all stocked items alongside their relevant information. This ensures quick access to essential details for seamless warehouse management.</p>
    </td>
    <td width="50%" align="center">
      <img src="frontend/src/assets/ReadmeImg/Inv.png" alt="Inventory">
    </td>
  </tr>

  <tr>
    <td width="50%" align="center">
      <img src="frontend/src/assets/ReadmeImg/CraftQue.png" alt="Active Jobs & Queue">
    </td>
    <td width="50%">
      <h3>Crafting: Active Jobs & Queue</h3>
      <p>This section displays actively crafting orders and upcoming queued items. Users can easily pause, cancel, or expedite orders to double the crafting speed as needed.</p>
    </td>
  </tr>

  <tr>
    <td width="50%">
      <h3>Crafting: Blueprints</h3>
      <p>On the blueprint screen, users can select specific blueprints to review their material requirements. It also provides options to initiate a craft, edit, or delete existing blueprints from the system.</p>
    </td>
    <td width="50%" align="center">
      <img src="frontend/src/assets/ReadmeImg/CraftItem.png" alt="Blueprints">
    </td>
  </tr>

  <tr>
    <td width="50%" align="center">
      <img src="frontend/src/assets/ReadmeImg/CarftHis.png" alt="Order History">
    </td>
    <td width="50%">
      <h3>Crafting: Order History</h3>
      <p>The order history page logs all previous crafting activities for easy reference. Users can review comprehensive details of both completed and cancelled orders from the past.</p>
    </td>
  </tr>

  <tr>
    <td width="50%">
      <h3>New Blueprint</h3>
      <p>This screen allows users to seamlessly add a completely new blueprint to the system. Existing blueprints can also be edited here to ensure crafting requirements are kept up to date.</p>
    </td>
    <td width="50%" align="center">
      <img src="frontend/src/assets/ReadmeImg/CraftNewBlue.png" alt="New Blueprint">
    </td>
  </tr>

  <tr>
    <td width="50%" align="center">
      <img src="frontend/src/assets/ReadmeImg/AdminAnalitics.png" alt="Analytics">
    </td>
    <td width="50%">
      <h3>Analytics (Admin Only)</h3>
      <p>The analytics dashboard provides administrators with valuable insights into crafted item volumes compared to their base costs. It also highlights the most frequently crafted blueprints to help managers optimise production.</p>
    </td>
  </tr>

  <tr>
    <td width="50%">
      <h3>User Management (Admin Only)</h3>
      <p>Administrators can use this page to add new users or assign admin privileges. It also allows for the easy editing or deletion of current user data to maintain secure access control.</p>
    </td>
    <td width="50%" align="center">
      <img src="frontend/src/assets/ReadmeImg/AdminUsers.png" alt="User Management">
    </td>
  </tr>
</table>



## Running locally

The backend and a PostgreSQL database run in Docker, so local work never touches the hosted database. Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/), the .NET 10 SDK and Node.js.

```bash
docker compose up --build        # API on http://localhost:8080 (Swagger at /swagger), seeded with demo data

cd frontend && npm install
REACT_APP_API_BASE=http://localhost:8080 npm run web   # React dev server on http://localhost:3000
# PowerShell: $env:REACT_APP_API_BASE="http://localhost:8080"; npm run web

npm start                        # optional, in a second terminal: the Electron window, loading the dev server
```

Open http://localhost:3000 in a browser, or use the Electron window. Sign in as `admin@artifax.local` / `ArtifaxDev1`, then set up 2FA with an authenticator app. Because this is a separate local account, it gets its own authenticator entry. `docker compose down -v` wipes the local database, and the next start seeds it again.

Tests:

```bash
dotnet test Backend.Tests                                   # includes real-PostgreSQL tests (needs Docker)
dotnet test Backend.Tests --filter "Category!=RequiresDocker"  # without Docker
cd frontend && npm test
```

## Test Coverage

All tests pass: **116 backend** and **49 frontend**. When the project was handed over, 4 backend and 27 frontend
tests were failing. See [Portfolio changes](docs/PORTFOLIO-CHANGES.md#213-out-of-date-tests).

### Backend
- **Unit tests** (xUnit, EF Core in-memory database, Moq) exercise the controllers directly: CRUD, validation,
  status codes and DTO mapping.
- **Real-database tests** (31 of the 116) use [Testcontainers](https://testcontainers.com/) to start a throwaway
  PostgreSQL in Docker. They cover behaviour the in-memory database cannot show:
  - authorization through the full HTTP pipeline;
  - foreign keys and `ON DELETE RESTRICT`;
  - stock taken and returned in one transaction;
  - concurrent orders being unable to oversell stock.
- **Regression tests** cover the bugs fixed after hand-over. Each fails on the old code and passes on the new.
- **Coverage:** 58.7% of lines, excluding generated migration code, and 70.3% across controllers, services and
  authentication.

### Frontend
- Jest and React Testing Library tests for every page and the main components. They mock the shared API client and
  check that data loads, filters and forms behave, and that server errors (for example, crafting shortages) are
  shown.
- **Coverage:** 57.1% of lines (statements 56.8%, branches 43.5%, functions 57.8%).

Commands are under [Running locally](#running-locally). The real-database tests need Docker.

### Technologies
![Jest](https://img.shields.io/badge/-jest-%23C21325?style=for-the-badge&logo=jest&logoColor=white)
![Moq](https://img.shields.io/badge/-Moq-%4623B7?style=for-the-badge)
![xUnit](https://img.shields.io/badge/xUnit-5C2D91?style=for-the-badge&logo=.net&logoColor=white)
![Swagger](https://img.shields.io/badge/-Swagger-%23Clojure?style=for-the-badge&logo=swagger&logoColor=white)
![Insomnia](https://img.shields.io/badge/Insomnia-black?style=for-the-badge&logo=insomnia&logoColor=5849BE)
![Testcontainers](https://img.shields.io/badge/Testcontainers-291A3F?style=for-the-badge&logo=testcontainers&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)

In terms of testing we employed a suite of technologies in order to engage in various forms of both manual and automatic. This includes:
- Jest and xUnit for automated testing of our frontend and backend applications. These two technologies were also built in additions to react and dotnet.
- Swagger and Insomnia for manual testing of backend during early to mid and later development accordingly.
- Testcontainers and Docker for the backend tests that run against a real PostgreSQL database.

## Technologies used

The following section outlines all the technologies used for development and deployment of Artifax. 

---

### Frontend Technologies
![NodeJS](https://img.shields.io/badge/node.js-6DA55F.svg?style=for-the-badge&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![React Router](https://img.shields.io/badge/React_Router-CA4245?style=for-the-badge&logo=react-router&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![DaisyUI](https://img.shields.io/badge/daisyui-5A0EF8?style=for-the-badge&logo=daisyui&logoColor=white)
![Figma](https://img.shields.io/badge/figma-%23F24E1E.svg?style=for-the-badge&logo=figma&logoColor=white)
![PostCSS](https://img.shields.io/badge/PostCSS-%23DD3A0A.svg?style=for-the-badge&logo=postcss&logoColor=white)
![Chart.js](https://img.shields.io/badge/chart.js-F5788D.svg?style=for-the-badge&logo=chart.js&logoColor=white)

- **Node.JS** - Node.js is a powerful runtime environment that allows developers to run JavaScript on the server side, letting you build fast and scalable backend applications outside of a web browser.
- **React** - The foundational JavaScript library used for building the user interface.
- **React Router** - The standard routing library for React. It enables navigation between different pages/views in a Single Page Application (SPA) without reloading the page.
- **Axios** - A promise-based HTTP client used to send requests to backend APIs to fetch, send, or update data.
- **TailwindCSS** - Tailwind CSS is a utility-first CSS framework that allows you to build custom website designs incredibly fast by applying pre-made style classes directly inside your HTML or JSX components.
- **DaisyUI** - A popular component library plugin for Tailwind CSS. It provides ready to use components like buttons, modals, and cards so you don't have to write raw utility classes for everything.
- **PostCSS** - Build tools that work behind the scenes with Tailwind to compile your CSS and automatically add browser vendor prefixes  for cross-browser compatibility.
- **Chart.JS** - A popular JavaScript library used to render flexible, responsive charts (bar, line, pie charts, etc.).
- **Figma** - Figma is a collaborative, cloud based design tool used by product teams to create user interfaces, wireframes, and interactive prototypes for websites and mobile applications in real-time.

---

### Backend Technologies
![.Net](https://img.shields.io/badge/.NET-5C2D91?style=for-the-badge&logo=.net&logoColor=white)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)

- **ASP .Net** - .Net was the underlying technology for the establishment of the application’s backend api. It provides us with enterprise level tools that can scale with our growing needs.
    - **Entity Framework Core** - EF Core was primarily used for its ability to connect our application to our database on top of its various relationship modeling tools and migration system.
- **Postgres** - Postgres was the primary tool for creating and modelling our database as it is a highly reliable, open-source object-relational database management system.

---

### Deployment Technologies
![GitHub Actions](https://img.shields.io/badge/github%20actions-%232671E5.svg?style=for-the-badge&logo=githubactions&logoColor=white)
![Render](https://img.shields.io/badge/Render-%46E3B7.svg?style=for-the-badge&logo=render&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![Electron.js](https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white)

- **GitHub Actions** - Github Actions provides us with with the ability to create workflows that to build and deploy our backend api to our Docker container.
- **Docker** - Docker packages applications and their dependencies into standardized, isolated containers. These container could then be passed along to our Render server.
- **Render** - Render is our cloud platform of choice which we used to build and deploy our api contained within our docker application.
- **Electron** - Electron is used for the deployment of the web app in the form of a sharable executable application. 

## Creators

<a href="https://github.com/I-Know-What-You-Committed-Last-Summer/Artifax/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=I-Know-What-You-Committed-Last-Summer/Artifax" />
</a>

## Acknowledgements
![GitHub Copilot](https://img.shields.io/badge/github_copilot-8957E5?style=for-the-badge&logo=github-copilot&logoColor=white)
![Google Gemini](https://img.shields.io/badge/google%20gemini-8E75B2?style=for-the-badge&logo=google%20gemini&logoColor=white)
![Stack Overflow](https://img.shields.io/badge/-Stackoverflow-FE7A16?style=for-the-badge&logo=stack-overflow&logoColor=white)

Lastly we would like to acknowledge the following people and resources that aided in the creation of the application:

- [Tsungai Katsuro](https://github.com/TsungaiKats)
- William Basson
- Simba Zengeni
- Stack Overflow Community
- Github Copilot
- Google Gemini
