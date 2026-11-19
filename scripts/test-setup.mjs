const API_URL = process.env.API_URL || "http://localhost:3001";
const TEST_MARKER = "maison-review-demo";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path}: HTTP ${response.status}`);
  }

  return response.status === 204 ? null : response.json();
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

const today = new Date();
const checkOut = formatDate(today);
const checkInDate = new Date(today);
checkInDate.setDate(checkInDate.getDate() - 2);
const checkIn = formatDate(checkInDate);

const bookings = await request("/bookings");
const existingTest = bookings.find(
  (booking) => booking.testRun === TEST_MARKER
);

if (existingTest) {
  console.log("Já existe uma reserva de teste ativa.");
  console.log(`ID: ${existingTest.id}`);
  console.log("Use npm run test:cleanup antes de criar outra.");
  process.exit(0);
}

const booking = await request("/bookings", {
  method: "POST",
  body: JSON.stringify({
    guestId: "guest-001",
    roomId: "room-101",
    checkIn,
    checkOut,
    status: "completed",
    services: [],
    totalPrice: 0,
    guestCount: 1,
    paymentStatus: "simulated",
    paymentMethod: "card",
    testRun: TEST_MARKER,
  }),
});

console.log("Reserva temporária criada com sucesso!");
console.log(`ID: ${booking.id}`);
console.log(`Quarto: room-101`);
console.log(`Hóspede: guest-001`);
console.log("Agora você pode testar o envio de uma avaliação.");