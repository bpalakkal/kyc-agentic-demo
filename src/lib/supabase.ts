import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://tbinrohphlzipnrmdvqd.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiaW5yb2hwaGx6aXBucm1kdnFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwOTc5MDAsImV4cCI6MjA5NjY3MzkwMH0.YuGwACqtHMIyEe6fAKzXN59ThdI7VnGz8tB5Cdt57VQ"
);
