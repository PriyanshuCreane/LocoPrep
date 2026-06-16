const email = "demo@locoprep.dev";
const password = "newpassword123";

fetch("http://localhost:3000/api/auth/reset-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password })
}).then(res => res.json()).then(console.log).catch(console.error);
