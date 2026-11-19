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

const bookings = await request("/bookings");
const testBookings = bookings.filter(
  (booking) => booking.testRun === TEST_MARKER
);

const testBookingIds = new Set(testBookings.map((booking) => booking.id));

const reviews = await request("/reviews");
const testReviews = reviews.filter(
  (review) => testBookingIds.has(review.bookingId)
);

for (const review of testReviews) {
  await request(`/reviews/${encodeURIComponent(review.id)}`, {
    method: "DELETE",
  });
  console.log(`Avaliação removida: ${review.id}`);
}

for (const booking of testBookings) {
  await request(`/bookings/${encodeURIComponent(booking.id)}`, {
    method: "DELETE",
  });
  console.log(`Reserva removida: ${booking.id}`);
}

console.log(
  testBookings.length || testReviews.length
    ? "Limpeza dos testes concluída."
    : "Nenhum registro de teste novo encontrado."
);