import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 Load Test Configuration
export const options = {
  stages: [
    { duration: '20s', target: 1000 },  // Ramp up to 1000 concurrent users
    { duration: '40s', target: 2000 },  // Steady state at 2000 users
    { duration: '30s', target: 4000 },  // Stress test: Ramp up to 4000 users
    { duration: '15s', target: 0 },     // Cool down to 0 users
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],   // Error rate must be less than 2%
    http_req_duration: ['p(95)<800'], // 95% of requests must complete under 800ms
  },
};

const BASE_URL = 'http://localhost:8080';

// Helper to generate dynamic mock user emails to prevent database primary key locks
function getRandomUserEmail() {
  const randNum = Math.floor(Math.random() * 1000000);
  return `stress_user_${randNum}@test.com`;
}

// Simulated User Journey
export default function () {
  const userEmail = getRandomUserEmail();
  const headers = { 'Content-Type': 'application/json' };

  // --- Step 1: Browse Catalog (Reads from MongoDB) ---
  const productsResponse = http.get(`${BASE_URL}/api/products`, { headers });
  check(productsResponse, {
    'Catalog response status is 200': (r) => r.status === 200,
    'Catalog contains products': (r) => r.json().length > 0,
  });
  sleep(1); // User pauses to look at products

  // Identify a product to purchase (default fallback to product ID "1" if list is empty)
  let productId = '1';
  let productName = 'Default Item';
  let productPrice = 99.99;
  
  try {
    const products = productsResponse.json();
    if (products && products.length > 0) {
      const idx = Math.floor(Math.random() * products.length);
      productId = products[idx].id;
      productName = products[idx].name;
      productPrice = products[idx].price;
    }
  } catch (e) {
    // Ignored
  }

  // --- Step 2: Add Product to Shopping Cart (Writes to Redis) ---
  const cartPayload = JSON.stringify({
    productId: productId,
    name: productName,
    quantity: 1,
    price: productPrice
  });

  const cartResponse = http.post(
    `${BASE_URL}/api/cart/${userEmail}/add`,
    cartPayload,
    { 
      headers,
      tags: { name: '/api/cart/{userEmail}/add' }
    }
  );
  check(cartResponse, {
    'Cart updated successfully (200)': (r) => r.status === 200,
  });
  sleep(1);

  // --- Step 3: Trigger Saga Checkout (Writes to Postgres + Emits RabbitMQ Events) ---
  const orderResponse = http.post(
    `${BASE_URL}/api/orders?userId=${userEmail}`,
    null,
    { 
      headers,
      tags: { name: '/api/orders?userId={userEmail}' }
    }
  );
  check(orderResponse, {
    'Order created & Saga started (201)': (r) => r.status === 201 || r.status === 200,
  });

  sleep(2); // User waits before starting another session loop
}
