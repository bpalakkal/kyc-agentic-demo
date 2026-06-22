import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://xnixtxpftxcehlbmgsga.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaXh0eHBmdHhjZWhsYm1nc2dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDQyNzcsImV4cCI6MjA5NTgyMDI3N30.k8lfH0N-ue0PVr7Hk6RJn0lUB031664_Q9qz7ZoztdY"
);
