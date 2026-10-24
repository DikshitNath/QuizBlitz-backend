# QuizBlitz Backend

QuizBlitz Backend is an Express, MongoDB, and Socket.IO service for creating quizzes, hosting multiplayer quiz games, and retrieving finished-game history.

## Requirements

- Node.js 18 or later
- MongoDB
- A Groq API key for AI-generated quizzes

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:

   ```dotenv
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/quizblitz
   GROQ_API_KEY=your_groq_api_key
   ```

3. Start the server:

   ```bash
   npm run dev
   ```

   Or run it without the development watcher:

   ```bash
   npm start
   ```

The server listens on `PORT` (default `3000`) and starts only after connecting to MongoDB. HTTP requests use JSON (`Content-Type: application/json`). The API base URL in the examples is `http://localhost:3000`.

## HTTP API

### Health check

`GET /health`

Checks that the server is responding.

**Response — `200 OK`**

```json
{
  "ok": true,
  "message": "CI/CD is live and working!"
}
```

### Generate a quiz from a topic

`POST /api/quiz/generate-topic`

**Request body**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `topic` | string | Yes | Subject for the generated quiz. |
| `timerSeconds` | number | No | Seconds allowed per question; defaults to `20`. |
| `difficulty` | object | No | Counts by difficulty: `{ "easy": number, "medium": number, "hard": number }`. Defaults to 2 easy, 2 medium, and 1 hard question. |
| `numQuestions` | number | No | If positive, determines the total and overrides `difficulty` with an approximately 40% easy, 40% medium, 20% hard split. |

When `numQuestions` is omitted or not positive, the total is the sum of the provided difficulty counts.

**Example**

```json
{
  "topic": "The solar system",
  "timerSeconds": 25,
  "difficulty": {
    "easy": 2,
    "medium": 1,
    "hard": 1
  }
}
```

**Response — `200 OK`**

```json
{
  "quizId": "665f1a2b3c4d5e6f78901234",
  "title": "The Solar System Quiz",
  "questions": [
    {
      "_id": "665f1a2b3c4d5e6f78901235",
      "text": "Which planet is known as the Red Planet?",
      "options": ["Venus", "Mars", "Jupiter", "Mercury"],
      "correctIndex": 1,
      "difficulty": "easy"
    }
  ],
  "timerSeconds": 25,
  "totalQuestions": 4,
  "difficulty": {
    "easy": 2,
    "medium": 1,
    "hard": 1
  }
}
```

The `questions` array contains the answer key (`correctIndex` is zero-based). The stored quiz is used to create a game.

**Errors**

- `400 Bad Request`: `{ "error": "topic required" }` if `topic` is missing or empty.
- `500 Internal Server Error`: `{ "error": "AI generation failed: ..." }` if generation or saving fails.

### Generate a quiz from text (for PDF-extracted content)

`POST /api/quiz/generate-pdf`

The API accepts text content; it does not accept or parse a PDF file itself. Supply extracted text in the request body.

**Request body**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `text` | string | Yes | Source content. At most the first 3,000 characters are sent as quiz context. |
| `title` | string | No | Quiz title and topic prompt; defaults to `"Quiz"`. The generated title is used if present. |
| `timerSeconds` | number | No | Seconds allowed per question; defaults to `20`. |
| `difficulty` | object | No | Difficulty counts, same format and default as `/api/quiz/generate-topic`. |
| `numQuestions` | number | No | Positive value sets the total and determines the approximate 40/40/20 difficulty split. |

**Example**

```json
{
  "title": "Introduction to Photosynthesis",
  "text": "Photosynthesis is the process by which green plants convert light energy...",
  "timerSeconds": 20,
  "numQuestions": 5
}
```

**Response — `200 OK`**

Returns the same shape as `/api/quiz/generate-topic`, including `quizId`, `title`, `questions`, `timerSeconds`, `totalQuestions`, and `difficulty`.

**Errors**

- `400 Bad Request`: `{ "error": "text required" }` if `text` is missing or empty.
- `500 Internal Server Error`: `{ "error": "AI generation failed: ..." }` if generation or saving fails.

### Create a quiz manually

`POST /api/quiz/manual`

**Request body**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | No | Quiz title; defaults to `"Quiz"`. |
| `questions` | array | Yes | One or more questions. Each question has `text`, `options` (string array), `correctIndex` (zero-based number), and optional `difficulty` (`easy`, `medium`, or `hard`, default `medium`). |
| `timerSeconds` | number | No | Seconds allowed per question; defaults to `20`. |

**Example**

```json
{
  "title": "General Knowledge",
  "timerSeconds": 20,
  "questions": [
    {
      "text": "What is the capital of France?",
      "options": ["Berlin", "Madrid", "Paris", "Rome"],
      "correctIndex": 2,
      "difficulty": "easy"
    }
  ]
}
```

**Response — `200 OK`**

```json
{
  "quizId": "665f1a2b3c4d5e6f78901234",
  "title": "General Knowledge",
  "questions": [
    {
      "_id": "665f1a2b3c4d5e6f78901235",
      "text": "What is the capital of France?",
      "options": ["Berlin", "Madrid", "Paris", "Rome"],
      "correctIndex": 2,
      "difficulty": "easy"
    }
  ],
  "timerSeconds": 20,
  "totalQuestions": 1
}
```

**Errors**

- `400 Bad Request`: `{ "error": "questions required" }` if `questions` is absent or empty.
- `500 Internal Server Error`: `{ "error": "..." }` if saving fails.

### Create a game

`POST /api/game/create`

Creates a waiting game with a unique six-digit PIN for an existing quiz.

**Request body**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `quizId` | string | Yes | MongoDB ID returned when a quiz is created. |

**Example**

```json
{
  "quizId": "665f1a2b3c4d5e6f78901234"
}
```

**Response — `200 OK`**

```json
{
  "pin": "482731",
  "gameId": "665f2b3c4d5e6f7890123456",
  "totalQuestions": 5,
  "timerSeconds": 20,
  "title": "General Knowledge"
}
```

**Errors**

- `400 Bad Request`: `{ "error": "quizId required" }` if `quizId` is missing.
- `404 Not Found`: `{ "error": "Quiz not found" }` if no quiz matches the ID.
- `500 Internal Server Error`: `{ "error": "..." }` if creating the game fails.

### Get game details by PIN

`GET /api/game/:pin`

**Example:** `GET /api/game/482731`

**Response — `200 OK`**

```json
{
  "pin": "482731",
  "status": "waiting",
  "currentQuestion": 0,
  "totalQuestions": 5,
  "timerSeconds": 20,
  "title": "General Knowledge",
  "players": [
    {
      "name": "Sam",
      "score": 0,
      "avatarEmoji": "🎮"
    }
  ]
}
```

`status` is one of `waiting`, `started`, `reveal`, or `finished`. `currentQuestion` is zero-based.

**Errors**

- `404 Not Found`: `{ "error": "Game not found" }`.
- `500 Internal Server Error`: `{ "error": "..." }` if looking up the game fails.

### Get host game history

`GET /api/history/host/:userId`

Returns up to 20 finished games created by the supplied user ID, newest first.

**Example:** `GET /api/history/host/firebase-user-id`

**Response — `200 OK`**

```json
{
  "history": [
    {
      "id": "665f2b3c4d5e6f7890123456",
      "pin": "482731",
      "quizTitle": "General Knowledge",
      "playerCount": 3,
      "winner": "Sam",
      "winnerEmoji": "🦊",
      "topScore": 2450,
      "playedAt": "2025-01-15T12:30:00.000Z"
    }
  ]
}
```

If there are no matching games, `history` is an empty array.

**Error — `500 Internal Server Error`**

```json
{
  "message": "..."
}
```

### Get player game history

`GET /api/history/player/:userId`

Returns up to 20 finished games joined by the supplied user ID, newest first.

**Example:** `GET /api/history/player/firebase-user-id`

**Response — `200 OK`**

```json
{
  "history": [
    {
      "id": "665f2b3c4d5e6f7890123456",
      "pin": "482731",
      "quizTitle": "General Knowledge",
      "myScore": 1800,
      "myRank": 2,
      "totalPlayers": 3,
      "playedAt": "2025-01-15T12:30:00.000Z"
    }
  ]
}
```

If there are no matching games, `history` is an empty array.

**Error — `500 Internal Server Error`**

```json
{
  "message": "..."
}
```

## Socket.IO real-time API

Connect a Socket.IO client to the same server origin as the HTTP API. The client sends the events below with JSON-object payloads. Events described as room broadcasts are sent to clients joined to the game PIN room.

### Client-to-server events

| Event | Payload | Behavior |
| --- | --- | --- |
| `host-join` | `{ "pin": "482731", "userId": "optional-user-id" }` | Joins the host socket to the game room, saves its socket ID (and optional host user ID), then emits `host-joined` to that socket. |
| `player-join` | `{ "pin": "482731", "name": "Sam", "userId": "optional-user-id" }` | Joins a player to a waiting game. `userId` is optional. A returning player with the same name is reconnected; otherwise a player is added with a random avatar and score of zero. Emits `player-joined` to that socket and `players-updated` to the room. |
| `start-game` | `{ "pin": "482731" }` | Starts the game at question index `0` and emits the first `question` to the room. |
| `submit-answer` | `{ "pin": "482731", "name": "Sam", "answerIndex": 2, "timeTakenMs": 3200 }` | Records the player's first answer for the current question. Emits `answer-received` to that socket and `answer-count` to the host socket. |
| `reveal-answer` | `{ "pin": "482731" }` | Scores correct answers, changes the game status to `reveal`, and emits `answer-revealed` to the room. |
| `next-question` | `{ "pin": "482731" }` | Advances to and emits the next `question`, or marks the game finished and emits `game-finished` after the last question. |
| `end-game` | `{ "pin": "482731" }` | Finishes the game immediately and emits `game-finished` to the room. |

### Server-to-client events

| Event | Recipient | Payload |
| --- | --- | --- |
| `error` | Requesting socket | `{ "message": "Game not found" }` or `{ "message": "Game already started" }`. |
| `host-joined` | Host socket | `{ "pin", "totalQuestions", "timerSeconds", "title", "players" }`. Each player has `name`, `score`, and `avatarEmoji`. |
| `player-joined` | Joining player socket | `{ "name", "pin", "avatarEmoji", "totalQuestions", "timerSeconds", "title" }`. |
| `players-updated` | Game room | `{ "players": [{ "name", "score", "avatarEmoji" }] }`. |
| `question` | Game room | `{ "index", "totalQuestions", "timerSeconds", "text", "options" }`. The correct answer index is not included in this event. |
| `answer-received` | Answering socket | `{ "questionIndex" }`. |
| `answer-count` | Host socket | `{ "count", "total", "answerCounts" }`. `answerCounts` is a four-item array of counts for option indices 0–3. |
| `answer-revealed` | Game room | `{ "correctIndex", "questionIndex", "answerCounts", "leaderboard" }`. Each leaderboard entry has `name`, `score`, and `avatarEmoji`. |
| `game-finished` | Game room | `{ "leaderboard": [{ "name", "score", "avatarEmoji" }] }`, sorted by descending score. |

Correct answers earn `100 + max(0, 1000 - floor(timeTakenMs / 10))` points. Players are identified by name when answers are recorded. The game host starts, advances, reveals, or ends a game by emitting the corresponding event.

## Notes

- AI quiz generation requires `GROQ_API_KEY` to be configured in the environment.
- MongoDB must be reachable using `MONGODB_URI`; the server exits if the initial connection fails.
- The API currently has no authentication middleware. History routes use the supplied `userId` as a lookup key.
- CORS is enabled for HTTP and Socket.IO connections.
