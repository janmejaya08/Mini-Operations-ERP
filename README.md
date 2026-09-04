# Mini Operations ERP

A production-oriented, full-stack Mini Operations ERP built to manage multi-location inventory, work order shortage checks, atomic two-phase stock transfers, and concurrency-safe customer order reservations.

---

## Tech Stack

- **Backend:** Node.js, Express.js
- **Database & ORM:** SQLite / PostgreSQL, Prisma ORM
- **Authentication:** JSON Web Tokens (JWT), bcryptjs
- **Testing:** Jest, Supertest
- **Frontend:** React 18, Vite, Vanilla CSS

---

## Core Business Invariants & Rules

1. **Calculated Available Stock:**
   $$\text{Available Quantity} = \text{Physical Quantity} - \text{Reserved Quantity}$$
   The system prevents negative physical quantities, reservations exceeding available stock, and invalid deductions.

2. **Shortage Calculation:**
   $$\text{Shortage} = \max(0, \text{Required Quantity} - \text{Available Quantity at Location})$$
   Calculated dynamically whenever work orders are inspected.

3. **Two-Phase Transfer Flow:**
   - **On Dispatch:** Decrements physical stock from the source location immediately.
   - **Before Receipt:** Destination stock remains unchanged.
   - **On Receipt:** Increments physical stock at the destination location. Replaying a receipt call on an already received transfer is strictly rejected.

4. **Concurrency & Overselling Prevention:**
   Customer order reservations execute inside isolated database transactions (`$transaction`), verifying real-time available stock before incrementing the reserved count to prevent race conditions when concurrent orders arrive.


-----------------------------------------------------------------------------------------------------
-cd backend
-npm install
-npx prisma generate
-npx prisma db push
-npm run seed
-npm run test # Runs all 5 mandatory test validations
-npm run dev  # Starts API on http://localhost:4000
-**cd ../frontend
-npm install
-npm run dev  # Starts UI on http://localhost:5173

-------------------------------------------------------------------------------------------------------
---

## Environment Configuration

### Backend Environment Variables (`backend/.env`)
Create a `.env` file inside the `backend/` directory:

```env
PORT=4000
DATABASE_URL="file:./dev.db"
JWT_SECRET="erp-super-secret-production-key-2026"
NODE_ENV="development"

