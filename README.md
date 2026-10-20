# 🗺 SmartRoute — Intelligent Multi-Vehicle Route Optimization & Real-Time Telematics Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-brightgreen)](https://harshitmangal.github.io/smartroute/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/HarshitMangal/smartroute)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Live Web Application**: [https://harshitmangal.github.io/smartroute/](https://harshitmangal.github.io/smartroute/)

> **A High-Performance Enterprise Logistics Engine integrating Advanced Graph DSA, Operating Systems Concurrency, In-Memory Caching, and Full-Duplex WebSockets.**

---

## 🏗 System Architecture

```
                                    ┌────────────────────────────────────────────────────────┐
                                    │                   REACT 18 FRONTEND                    │
                                    │  - Leaflet Map (Jodhpur GPS & OpenStreetMap Tiles)      │
                                    │  - Live Fleet Tracking HUD (Moving Vans 🚚)            │
                                    │  - Traffic Jam Toggle & Printable Driver Manifests     │
                                    └───────────────▲────────────────────────▲───────────────┘
                                                    │                        │
                                      HTTP / REST   │                        │ WebSockets (ws://)
                                      Port 5000     │                        │ Real-Time Telematics (10 Hz)
                                                    ▼                        ▼
                                    ┌────────────────────────────────────────────────────────┐
                                    │                  NODE.JS / EXPRESS API                 │
                                    │  - Route Orchestrator & JWT / MFA (2FA TOTP) Gate      │
                                    │  - Socket.io Telematics Ingestion & Broadcast          │
                                    └───────────▲──────────────────▲────────────────▲────────┘
                                                │                  │                │
                         Read/Write Cache       │                  │ Data History   │ OS Anonymous
                         <1ms Latency           │                  │ Storage        │ Pipes (IPC)
                                                ▼                  ▼                ▼
                                         ┌─────────────┐    ┌─────────────┐  ┌──────────────────────┐
                                         │ REDIS CACHE │    │   MONGODB   │  │  C++14 ENGINE BINARY │
                                         │ (LRU Store) │    │  (History)  │  │ (Multi-Threaded)     │
                                         └─────────────┘    └─────────────┘  └──────────────────────┘
```

---

## 📸 Screenshots & UI Showcase

### 1. 🏢 Enterprise Dispatcher & Driver Authentication Gateway
> Secure role-based login gate with 1-click instant demo profiles for Logistics Dispatchers and Delivery Drivers, plus Google Authenticator TOTP Multi-Factor Authentication.

![Authentication Gateway](screenshots/01_auth_gate.png)

---

### 2. 📍 Interactive Route Planning & Real-Time Navigation
> Point-to-point guaranteed shortest path with interactive OpenStreetMap Leaflet visualization in Jodhpur, featuring Expected Travel Time (ETA), fuel consumption estimation, and Dijkstra / A* route computation.

![Dispatcher Console](screenshots/02_dispatcher_console.png)

---

### 3. 📦 1-Van Multi-Stop Delivery Optimization (TSP)
> Heuristic tour construction via Nearest Neighbor combined with 2-Opt local search refinement, eliminating path intersections and calculating distance savings percentages.

![Delivery Optimization](screenshots/03_delivery_optimization.png)

---

### 4. 🚛 Multi-Vehicle Fleet Dispatch (CVRP)
> Capacitated Vehicle Routing Problem clustering multiple delivery vans from a central depot, respecting vehicle package capacity bounds with color-coded van routes.

![Fleet VRP](screenshots/04_fleet_vrp.png)

---

### 5. 🌲 Infrastructure Transit Backbone (Kruskal's MST)
> Minimum Spanning Tree computation using Kruskal's Algorithm with Disjoint Set Union (Path Compression + Union by Rank) to identify the minimum-cost road network without cycles.

![Transit Backbone MST](screenshots/05_transit_backbone_mst.png)

---

## ⚡ Core Technical Pillars

### 1. Data Structures & Algorithms (C++14)
* **Dijkstra's Algorithm**: Min-Heap priority queue (`std::priority_queue`) adjacency list implementation running in $O((V + E) \log V)$ for exact shortest paths.
* **A* (A-Star) Search**: Goal-directed heuristic search using Euclidean distance to prune unpromising branches.
* **Nearest Neighbor (TSP Heuristic)**: Greedy tour construction for initial delivery sequence in $O(N^2)$.
* **2-Opt Local Search**: Iterative tour improvement by swapping pairs of non-adjacent edges until no further 2-edge exchange reduces total route distance.
* **Capacitated Multi-Vehicle Routing Problem (CVRP)**: Greedy Depot clustering under vehicle package bounds followed by isolated 2-Opt refinement per vehicle cluster.
* **Kruskal's Minimum Spanning Tree (MST)**: Greedy backbone network construction with Disjoint Set Union (DSU) utilizing **Path Compression** ($O(\alpha(V))$ inverse Ackermann time) and **Union by Rank** to prevent redundant road cycles.

### 2. Advanced Queue Data Structures in Modern Logistics
* **0-1 BFS with Double-Ended Queue (`std::deque`)**: For road networks divided into Expressways/Flyovers (cost = 0) and City Streets (cost = 1), 0-1 BFS executes in **strictly linear time $O(V + E)$** by pushing 0-cost roads to the front (`push_front`) and 1-cost roads to the back (`push_back`), completely bypassing Dijkstra's $O((V + E) \log V)$ heap overhead!
* **Priority Queue / Min-Heap Order Dispatch (`std::priority_queue`)**: Implements instant delivery prioritization (Blinkit/Zepto/Medical logistics style). Orders are extracted via custom comparator, dispatching **Emergency Medicines (🔴 Priority 1)** and **10-minute instant orders (⚡ Priority 2)** before standard parcels (📦 Priority 3), regardless of proximity.
* **Circular Queue / Ring Buffer (Fixed RAM Telematics Stream)**: A constant $O(1)$ capacity FIFO buffer that records the vehicle's trailing GPS breadcrumb coordinates at 10 Hz without dynamic heap re-allocation or memory leaks.
* **FIFO Queue Breadth-First Search (`std::queue`)**: Solves for the delivery path with the **minimum number of traffic signals / intersections (hops)**, minimizing vehicle stop-and-go battery/fuel wear.
* **Work-Stealing Task Deques (Concurrency)**: Load-balancing model where idle delivery vans steal pending deliveries from the rear of overloaded vans' deques.

### 3. Operating Systems Concurrency
* **Task-Parallelism**: Each delivery van's 2-Opt route is solved concurrently on a dedicated OS worker thread (`_beginthreadex`).
* **Critical Section & Mutex Protection**: Global fleet metrics (`totalFleetDistance`, `maxRouteDistance`) are protected by an RAII `LockGuard` wrapping OS `CRITICAL_SECTION`, guaranteeing zero race conditions and zero deadlocks.
* **Barrier Synchronization**: The main thread synchronizes with worker threads using `WaitForMultipleObjects` before formatting the JSON output.
* **Inter-Process Communication (IPC)**: Decoupled native C++ engine communicating with Node.js via OS anonymous standard I/O pipes.

### 4. Distributed Systems, Reliability & Caching
* **Circuit Breaker Pattern (Netflix Hystrix Style)**: Protects Node.js from downstream engine stalls. Implements a 3-state machine (`CLOSED`, `OPEN`, `HALF-OPEN`) with execution timeouts and automatic fallback heuristics if the binary crashes.
* **Redis Caching Layer**: Route lookups hashed as `smartroute:algo:src:dest:edges` with a 1-hour TTL, reducing repeated route lookup latency from **65ms down to 1-4ms (94% drop)**.
* **Auto-Fallback**: Automatic in-memory LRU cache fallback when Redis server is offline.

### 5. Computer Networks & Real-Time Telematics
* **WebSockets (Socket.io RFC 6455)**: Full-duplex persistent bi-directional channel streaming vehicle GPS coordinates at 10 Hz without wasteful HTTP polling.
* **Geofencing & Delivery Milestones**: Automatic detection when a moving delivery vehicle arrives at a customer node, triggering milestone events.

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js**: v18+ installed
* **C++ Compiler**: MinGW GCC / G++ (supporting C++14)
* **MongoDB**: Local MongoDB instance (or MongoDB Atlas URI)

### 1. Compile C++ Engine
```bash
cd cpp-engine
g++ -std=c++14 -O2 -o route.exe main.cpp
```

### 2. Start Backend Server
```bash
cd backend
npm install
node server.js
# Backend runs on http://localhost:5000 (Socket: ws://localhost:5000)
```

### 3. Start Frontend App
```bash
cd frontend
npm install
npm run dev
# App opens at http://localhost:5173
```

---

## 🎤 Top 10 Interview Questions & Answers

### Q1: Why did you decouple the optimization engine into C++ instead of running it in Node.js?
> **Answer**: Node.js runs on a single-threaded V8 event loop. Running CPU-intensive algorithms like $O(N^2)$ 2-Opt or multi-stop CVRP directly in Node.js would block the event loop, causing all concurrent HTTP requests and WebSocket streams to stall. By delegating computation to a compiled C++14 binary communicating via OS Anonymous Pipes, we achieve sub-millisecond native speed and utilize all CPU cores via multithreading without blocking server I/O.

### Q2: How does your multithreading and mutex synchronization work?
> **Answer**: In our CVRP solver, each delivery vehicle's route optimization is embarrassingly parallel. We spawn dedicated OS worker threads (`_beginthreadex`) for each vehicle. To prevent **Race Conditions** when aggregating fleet-wide metrics (such as `totalFleetDistance`), we created an RAII `LockGuard` class over the OS `CRITICAL_SECTION` mutex primitive. The constructor acquires the lock and the destructor releases it, ensuring deadlock-free thread synchronization.

### Q3: What is the difference between Dijkstra and A* in your platform?
> **Answer**: Dijkstra explores nodes uniformly in concentric waves regardless of where the target is located ($f(n) = g(n)$). A* uses an admissible heuristic $h(n)$ representing the straight-line distance to the destination ($f(n) = g(n) + h(n)$), guiding the search frontier directly toward the goal and visiting significantly fewer graph nodes on larger road networks.

### Q4: Why WebSockets instead of HTTP polling for live vehicle tracking?
> **Answer**: HTTP polling requires repeated 3-way TCP handshakes and large HTTP header overhead every second, creating high server load. WebSockets establish a single persistent, full-duplex TCP connection (RFC 6455) allowing the server to stream real-time driver coordinates at 10 Hz with negligible latency (~2ms), exactly how Uber, Swiggy, and Blinkit track drivers.

### Q5: How did you measure and implement Redis caching?
> **Answer**: We generate a deterministic SHA-256 hash key based on the graph topology, algorithm, and source/destination (`smartroute:algo:src:dest`). On a cache hit, the route is returned directly from Redis memory in under 4ms, bypassing C++ engine execution and reducing database load by over 90%. If Redis is offline, the backend gracefully falls back to an in-memory Map LRU cache without throwing 500 errors.

### Q6: How does the Capacitated Vehicle Routing Problem (CVRP) work?
> **Answer**: CVRP extends TSP for a commercial fleet with capacity constraints. Starting from the central Depot (Clock Tower, Jodhpur), we cluster stops among $V$ delivery vans using greedy nearest-addition balancing while strictly respecting each vehicle's package capacity limit. Then, we execute 2-Opt local search on each vehicle's cluster concurrently to eliminate path crossings.

### Q7: How does your system handle Dynamic Traffic Jams?
> **Answer**: When "Peak Traffic Mode" is activated, central congested corridors (e.g. Paota, Ghanta Ghar) receive dynamic edge weight penalties ($3\times$). The graph solver immediately re-evaluates alternate paths, directing vehicles to bypass congested nodes and minimizing real-world delay.

### Q8: How does the Google Authenticator 2FA (MFA) work?
> **Answer**: During user registration, we use `speakeasy` to generate a cryptographic base32 secret and render a QR code with `qrcode`. The user scans this into Google Authenticator. When logging in, the app requests the 6-digit TOTP (Time-based One-Time Password), computed using HMAC-SHA1 on a 30-second rolling time window. Once verified, a signed JWT token is issued.

### Q9: What happens if MongoDB or Redis crashes?
> **Answer**: The system is designed with **Graceful Degradation**:
> - If Redis is unavailable, the caching layer transparently switches to an internal in-memory LRU cache.
> - If MongoDB is unavailable, route optimization, live WebSockets, and navigation continue to work uninterrupted, with non-critical history logging failing silently.

### Q10: How do you print driver dispatch run-sheets?
> **Answer**: We built a dedicated `DriverManifestModal` with `@media print` CSS rules. In 1 click, dispatchers generate a standardized logistics manifest containing the Manifest ID, vehicle route breakdown, landmark stops, checkboxes, and driver/supervisor signature blocks.

---

## 👥 Contributors & License
* **Developer**: Built with ❤️ for Smart Delivery Logistics in Jodhpur, Rajasthan.
* **License**: MIT
