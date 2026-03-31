# SAHLA-LIK Backend v2.0

Clean, production-ready Queue Management System API built with Express.js and MySQL.

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 16+ installed
- MySQL 8.0+ installed and running
- npm or yarn package manager

### 2. Database Setup

```bash
# Login to MySQL
mysql -u root -p

# Create database and run schema
source schema.sql

# Or via command line
mysql -u root -p < schema.sql
```

### 3. Install Dependencies

```bash
cd sahla_lik_backend
npm install
```

### 4. Configure Environment

Edit `.env` file with your database credentials:

```env
DB_HOST=localhost
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=sahlalik_db
JWT_SECRET=your_secret_key_change_in_production
```

### 5. Start Server

```bash
# Development
npm run dev

# Production
npm start
```

Server will start on `http://localhost:3001`

---

## 📁 Project Structure

```
sahla_lik_backend/
├── server.js                 # Main Express application
├── package.json              # Dependencies
├── .env                      # Environment variables
├── .env.example              # Environment template
├── schema.sql                # Database schema + seed data
├── README.md                 # This file
└── src/
    ├── config/
    │   └── db.js             # MySQL connection pool
    ├── controllers/
    │   ├── authController.js
    │   ├── agencyController.js
    │   ├── enterpriseController.js
    │   ├── ticketController.js
    │   ├── guichetController.js
    │   └── analyticsController.js
    ├── middleware/
    │   ├── auth.js           # JWT authentication
    │   └── rateLimiter.js    # Request rate limiting
    ├── routes/
    │   ├── auth.js
    │   ├── agencies.js
    │   ├── enterprises.js
    │   ├── tickets.js
    │   ├── guichets.js
    │   └── analytics.js
    └── utils/
        └── validators.js     # Input sanitization
```

---

## 🔐 Default Test Accounts

All passwords: `sahla123`

| Role | Email | Username |
|------|-------|----------|
| Admin | admin@sahla-lik.com | admin_master |
| Guichet 1 | guichet01@sahla-lik.com | guichet01 |
| Guichet 2 | guichet02@sahla-lik.com | guichet02 |
| Client | client@sahla-lik.com | client_test |

---

## 📡 API Endpoints

### Base URL
```
http://localhost:3001/api/v1
```

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | ❌ | Login with email/username |
| POST | `/auth/register` | ❌ | Register new user |
| POST | `/auth/logout` | ✅ | Logout |
| GET | `/auth/me` | ✅ | Get current user |
| POST | `/auth/otp/send` | ❌ | Send OTP |
| POST | `/auth/otp/verify` | ❌ | Verify OTP |
| POST | `/auth/password-reset` | ❌ | Reset password |

### Agencies

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/agencies` | Optional | List all agencies |
| GET | `/agencies/nearby` | Optional | Find nearby agencies |
| GET | `/agencies/search` | Optional | Search agencies |
| GET | `/agencies/:id` | Optional | Get agency details |
| GET | `/agencies/:id/queue` | Optional | Get agency queue |
| GET | `/agencies/:id/motifs` | Optional | Get service types |

### Enterprises

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/enterprises` | Optional | List all enterprises |
| GET | `/enterprises/:id` | Optional | Get enterprise details |
| GET | `/enterprises/:id/agencies` | Optional | Get enterprise agencies |
| GET | `/enterprises/categories` | ❌ | Get categories |
| GET | `/enterprises/motifs` | ❌ | Get all motifs |

### Tickets

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/tickets` | Optional | Create ticket |
| GET | `/tickets/mine` | ✅ | Get my tickets |
| PATCH | `/tickets/:id/cancel` | Optional | Cancel ticket |
| POST | `/tickets/call-next` | ✅ | Call next ticket |
| PATCH | `/tickets/:id/serve` | ✅ | Mark ticket served |

### Guichets (Counters)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/guichets/agence/:id` | ❌ | Get agency counters |
| GET | `/guichets/:id` | ❌ | Get counter details |
| POST | `/guichets/agence/:id` | ✅ | Create counter |
| PATCH | `/guichets/:id` | ✅ | Update counter |
| PATCH | `/guichets/:id/status` | ✅ | Update status |
| DELETE | `/guichets/:id` | ✅ | Delete counter |
| GET | `/guichets/:id/stats` | ❌ | Get counter stats |

### Analytics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/analytics/daily` | ❌ | Daily stats |
| GET | `/analytics/stats` | ❌ | Current stats |
| GET | `/analytics/weekly` | ❌ | Weekly stats |
| GET | `/analytics/monthly` | ❌ | Monthly stats |
| GET | `/analytics/insights` | ❌ | AI insights |
| POST | `/analytics/ratings` | ✅ | Submit rating |
| GET | `/analytics/ratings/:id` | Optional | Get agency ratings |

---

## 🔧 API Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable message"
}
```

### Authentication
Include JWT token in Authorization header:
```
Authorization: Bearer your_jwt_token_here
```

---

## 🧪 Testing with cURL

### Health Check
```bash
curl http://localhost:3001/api/v1/health
```

### Login
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin@sahla-lik.com","password":"sahla123"}'
```

### Get Agencies
```bash
curl http://localhost:3001/api/v1/agencies
```

### Create Ticket (with auth)
```bash
curl -X POST http://localhost:3001/api/v1/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"id_agence":1,"id_motif":1}'
```

---

## 🛡️ Security Features

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt with cost 12
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Sanitization**: All inputs validated and sanitized
- **SQL Injection Prevention**: Parameterized queries only
- **CORS**: Configured for specific origins
- **Error Handling**: Generic error messages in production

---

## 📊 Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | All user types (admin, guichet, client) |
| `enterprises` | Institutions/companies |
| `agences` | Agency branches |
| `guichets` | Counters/service points |
| `motifs` | Service types |
| `tickets` | Queue tickets |
| `files_attente` | Daily queue files |
| `service_ratings` | Service ratings |
| `notifications` | User notifications |

---

## 🐛 Troubleshooting

### Database Connection Failed
```
Error: ❌ Database connection failed
```
**Solution:** 
1. Ensure MySQL is running
2. Check `.env` credentials
3. Run `mysql -u root -p < schema.sql`

### Port Already in Use
```
Error: EADDRINUSE :::3001
```
**Solution:** Change PORT in `.env` or kill process on port 3001

### JWT Token Invalid
```
Error: INVALID_TOKEN
```
**Solution:** Login again to get a fresh token

---

## 📝 License

MIT License - SAHLA-LIK Team
