# Faith Fighters For America - Backend

This is the backend for the Faith Fighters For America application.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- [npm](https://www.npmjs.com/)

## Getting Started

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Set up the local database**:
    The project uses a local JSON database. Initial state can be set up by copying the example file:
    ```bash
    cp data/db.json.example data/db.json
    ```

4.  **Run the application**:
    ```bash
    npm run start:dev
    ```

## Project Structure

- `src/`: Application source code.
- `data/`: Local storage for the JSON database (ignored by Git).
- `dist/`: Compiled build output.
