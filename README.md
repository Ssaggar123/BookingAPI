# BookingAPI
Booking API is an API designed and developed to resolve the booking problems such as time-slot conflict handling., handles cross classes exceptions etc.
# Booking & Reservation System API

A RESTful API for managing bookable resources (rooms, appointments, classes, tables, etc.) with time-slot conflict handling, recurring availability, and cancellation policies.

Built with **Node.js**, **Express**, and **MongoDB**.

---

## Features

- 🔐 JWT-based authentication with role-based access (`customer`, `provider`, `admin`)
- 📅 Recurring weekly availability per resource
- 🚫 Blackout/exception dates (holidays, time-off)
- ⏱️ Automatic time-slot conflict detection on booking creation
- 🔒 Race-condition-safe booking (atomic slot claiming / transactions)
- ❌ Cancellation policy support (e.g. no cancellations within X hours of start)
- 📄 Input validation on all endpoints
- 🧪 (Planned) Automated test suite

---

## Tech Stack

| Layer          | Technology            |
|----------------|------------------------|
| Runtime        | Node.js               |
| Framework      | Express                |
| Database       | MongoDB (Mongoose)     |
| Auth           | JWT (access + refresh) |
| Validation     | Zod / Joi              |
| Docs           | OpenAPI / Swagger      |

---

## Project Structure

```
src/
├── models/         # Mongoose schemas (User, Resource, Availability, Booking, Exception)
├── routes/         # Express route definitions
├── controllers/    # Request handlers
├── services/       # Business logic (conflict detection, slot generation)
├── middleware/      # auth, role checks, validation, error handling
├── validators/      # Zod/Joi request schemas
├── utils/
├── config/          # DB connection, env config
└── app.js
```

---

## Data Models (Summary)

- **User** — customers, providers, admins
- **Resource** — the bookable thing (room, trainer, table, etc.), owned by a provider
- **Availability** — recurring weekly open hours for a resource
- **Exception** — blackout dates / overrides to normal availability
- **Booking** — an actual reservation with `startTime`, `endTime`, and `status`

Full schema details are documented in [`docs/SCHEMA.md`](./docs/SCHEMA.md).

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- MongoDB (local instance or Atlas cluster)

### Installation

```bash
git clone <your-repo-url>
cd booking-api
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/booking-api
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

### Run the server

```bash
# Development (with nodemon)
npm run dev

# Production
npm start
```

Server runs at `http://localhost:5000` by default.

---

## API Endpoints

### Auth
| Method | Endpoint             | Description          |
|--------|-----------------------|-----------------------|
| POST   | `/api/auth/register`  | Register a new user   |
| POST   | `/api/auth/login`     | Log in, get tokens    |
| POST   | `/api/auth/refresh`   | Refresh access token  |

### Resources
| Method | Endpoint                          | Description                     |
|--------|-------------------------------------|----------------------------------|
| GET    | `/api/resources`                    | List all resources               |
| POST   | `/api/resources`                    | Create a resource (provider/admin) |
| GET    | `/api/resources/:id`                | Get a single resource            |
| PATCH  | `/api/resources/:id`                | Update a resource                |
| DELETE | `/api/resources/:id`                | Delete a resource                |
| GET    | `/api/resources/:id/availability`   | Get open slots for a date range  |

### Bookings
| Method | Endpoint                     | Description                      |
|--------|--------------------------------|------------------------------------|
| POST   | `/api/bookings`                | Create a new booking               |
| GET    | `/api/bookings`                | List bookings (filterable)         |
| GET    | `/api/bookings/:id`             | Get a single booking               |
| PATCH  | `/api/bookings/:id`             | Update booking status              |
| POST   | `/api/bookings/:id/cancel`      | Cancel a booking (policy-checked)  |

Full request/response examples: [`docs/API.md`](./docs/API.md) *(or see Swagger UI at `/api-docs` once running)*.

---

## Roadmap

- [ ] Auth + User model
- [ ] Resource CRUD
- [ ] Availability model + open-slots endpoint
- [ ] Booking creation with conflict detection
- [ ] Transaction-based / atomic race-condition handling
- [ ] Cancellation policy enforcement
- [ ] Notifications (email/push) on booking confirmation
- [ ] Swagger/OpenAPI docs
- [ ] Deploy (Render/Railway) + connect Expo client

---

## License

MIT
