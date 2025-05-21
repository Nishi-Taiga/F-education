# Database Setup Guide

## Initial Setup for Supabase

When migrating from Replit to Vercel + Supabase, follow these steps to set up your database properly:

1. Create a new Supabase project
2. Go to the SQL Editor in Supabase
3. Execute each SQL file in the following order:

### Step 1: Create base tables
Run the `sql/schema.sql` file first to create all core tables.

### Step 2: Create parent profile table
Run the `sql/parent_profile.sql` file to create the parent_profile table required for parent user profiles.

### Step 3: Set up proper authentication
Make sure to configure your Row Level Security (RLS) policies correctly as defined in the SQL files.

## Migrating User Data

When migrating existing user data:

1. Export data from your original database
2. Transform the data to match the Supabase schema if necessary
3. Import the data using Supabase's import functionality or via SQL INSERT statements

## Troubleshooting

If you encounter the error: `Could not find the 'parent_name' column of 'parent_profile' in the schema cache`:

- Ensure that the `parent_profile` table has been created in your Supabase database
- Verify that the column is named `name` and not `parent_name` as specified in the `parent_profile.sql` file
- Clear your application cache if necessary

## Database Diagram

```
users
 ↓
 ├── parent_profile (1:1)
 │    └── students (1:N)
 └── tutors (1:1)
      └── bookings (1:N)
```

Each parent user can have multiple students, and each tutor can have multiple bookings. The database structure maintains these relationships through foreign keys.
