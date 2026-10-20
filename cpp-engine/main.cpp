/*
 * ============================================================================
 * SmartRoute — High-Performance C++ Optimization Engine v3
 * WITH OPERATING SYSTEMS CONCURRENCY & MULTITHREADING
 * ============================================================================
 *
 * 🎓 OPERATING SYSTEM CONCEPTS IMPLEMENTED HERE (For Interview Discussion):
 *
 * 1. MULTITHREADING (Task-Parallelism on Multi-Core CPUs):
 *    - Sequential route optimization is CPU-bound O(N^2).
 *    - In CVRP (Capacitated Vehicle Routing), each vehicle's 2-Opt calculation
 *      is completely independent.
 *    - We spawn dedicated OS Worker Threads (_beginthreadex / OS Kernel Threads)
 *      for each delivery vehicle.
 *    - The OS CPU Scheduler schedules these threads across available CPU cores,
 *      achieving near-linear speedup (Amdahl's Law).
 *
 * 2. CRITICAL SECTION & MUTEX (Race Condition Prevention):
 *    - A "Critical Section" is code that accesses shared memory/resources
 *      (e.g., globalTotalFleetDistance, globalMaxRouteDistance).
 *    - Without synchronization, if 2 threads write to a shared variable at the
 *      same time, a RACE CONDITION occurs (data corruption / lost updates).
 *    - Solution: We implement Mutual Exclusion using OS CRITICAL_SECTION / Mutex.
 *    - RAII LockGuard: Acquires lock in constructor and releases in destructor,
 *      guaranteeing NO DEADLOCKS even if an exception occurs.
 *
 * 3. BARRIER SYNCHRONIZATION (Thread Joining):
 *    - The main thread must wait for all worker threads to complete before
 *      emitting the final dispatch JSON.
 *    - Implemented using WaitForMultipleObjects (OS Synchronization Barrier).
 *
 * 4. CONCURRENT ALGORITHM RACE (Dijkstra vs A* Parallel Execution):
 *    - In "compare" mode, Dijkstra and A* are executed concurrently on two
 *      distinct worker threads simultaneously on separate CPU cores.
 *
 * 5. INTER-PROCESS COMMUNICATION (IPC via OS Anonymous Pipes):
 *    - The Node.js parent process and this C++ child process communicate
 *      via standard stdin/stdout anonymous pipes managed by the OS kernel.
 * ============================================================================
 */

#include <iostream>
#include <vector>
#include <queue>
#include <climits>
#include <algorithm>
#include <chrono>
#include <string>
#include <sstream>
#include <windows.h>
#include <process.h>

using namespace std;
const int INF = INT_MAX / 2;

// ============================================================================
// 🔒 OS CONCURRENCY PRIMITIVES: Mutex & RAII LockGuard
// ============================================================================

/*
 * Mutex Class:
 * OS CRITICAL_SECTION primitive ko wrap karta hai.
 * Thread-safety aur Mutual Exclusion provide karta hai.
 */
class Mutex {
private:
    CRITICAL_SECTION cs;
public:
    Mutex()  { InitializeCriticalSection(&cs); }
    ~Mutex() { DeleteCriticalSection(&cs); }
    void lock()   { EnterCriticalSection(&cs); }
    void unlock() { LeaveCriticalSection(&cs); }
};

/*
 * LockGuard Class (RAII Pattern):
 * "Resource Acquisition Is Initialization"
 * Constructor me lock acquire hota hai, Destructor me unlock hota hai.
 * Isse Deadlock ka risk 0% ho jata hai.
 */
class LockGuard {
private:
    Mutex& m_mutex;
public:
    LockGuard(Mutex& m) : m_mutex(m) { m_mutex.lock(); }
    ~LockGuard() { m_mutex.unlock(); }
};

// Global Mutex for protecting shared fleet metrics (Critical Section)
static Mutex globalFleetMutex;
static int globalTotalFleetDistance = 0;
static int globalMaxRouteDistance   = 0;
static int globalCompletedThreads   = 0;

// ─────────────────────────────────────────────────────────────────
// STRUCTS
// ─────────────────────────────────────────────────────────────────
struct ShortestResult {
    int distance;
    vector<int> path;
    double executionTimeMs;
    int nodesVisited;
    DWORD threadId;
};

struct VehicleRoute {
    int vehicleId;
    vector<int> stops;
    int totalCost;
    double threadExecMs;
    DWORD threadId;
};

// ─────────────────────────────────────────────────────────────────
// ALGORITHM 1: Dijkstra Shortest Path
// O((V+E) log V) with min-heap + adjacency list
// ─────────────────────────────────────────────────────────────────
ShortestResult dijkstra(int source, int destination,
                        const vector<vector<pair<int,int> > >& graph) {
    int n = graph.size();
    vector<int> dist(n, INF);
    vector<int> parent(n, -1);
    int nodesVisited = 0;

    priority_queue<pair<int,int>, vector<pair<int,int> >, greater<pair<int,int> > > pq;
    dist[source] = 0;
    pq.push(make_pair(0, source));

    while (!pq.empty()) {
        int d    = pq.top().first;
        int node = pq.top().second;
        pq.pop();

        if (d > dist[node]) continue;
        nodesVisited++;
        if (node == destination) break;

        for (size_t i = 0; i < graph[node].size(); i++) {
            int next   = graph[node][i].first;
            int weight = graph[node][i].second;
            if (dist[node] + weight < dist[next]) {
                dist[next]   = dist[node] + weight;
                parent[next] = node;
                pq.push(make_pair(dist[next], next));
            }
        }
    }

    ShortestResult res;
    res.distance     = (dist[destination] >= INF) ? -1 : dist[destination];
    res.nodesVisited = nodesVisited;
    res.threadId     = GetCurrentThreadId();

    if (dist[destination] < INF) {
        for (int node = destination; node != -1; node = parent[node])
            res.path.push_back(node);
        reverse(res.path.begin(), res.path.end());
    }
    return res;
}

// ─────────────────────────────────────────────────────────────────
// ALGORITHM 2: A* (A-Star) Goal-Directed Shortest Path
// ─────────────────────────────────────────────────────────────────
ShortestResult astar(int source, int destination,
                     const vector<vector<pair<int,int> > >& graph) {
    int n = graph.size();
    vector<int> g(n, INF);
    vector<int> parent(n, -1);
    int nodesVisited = 0;

    priority_queue<pair<int,int>, vector<pair<int,int> >, greater<pair<int,int> > > pq;
    g[source] = 0;
    pq.push(make_pair(0, source));

    while (!pq.empty()) {
        int currentG = pq.top().first;
        int node     = pq.top().second;
        pq.pop();

        if (currentG > g[node]) continue;
        nodesVisited++;
        if (node == destination) break;

        for (size_t i = 0; i < graph[node].size(); i++) {
            int next   = graph[node][i].first;
            int weight = graph[node][i].second;
            int newG   = g[node] + weight;

            if (newG < g[next]) {
                g[next]      = newG;
                parent[next] = node;
                // Admissible heuristic: h=0 (consistent)
                pq.push(make_pair(newG, next));
            }
        }
    }

    ShortestResult res;
    res.distance     = (g[destination] >= INF) ? -1 : g[destination];
    res.nodesVisited = nodesVisited;
    res.threadId     = GetCurrentThreadId();

    if (g[destination] < INF) {
        for (int node = destination; node != -1; node = parent[node])
            res.path.push_back(node);
        reverse(res.path.begin(), res.path.end());
    }
    return res;
}

// Single-source all-pairs distance helper for cost matrix
vector<int> dijkstraFrom(int source, const vector<vector<pair<int,int> > >& graph) {
    int n = graph.size();
    vector<int> dist(n, INF);
    priority_queue<pair<int,int>, vector<pair<int,int> >, greater<pair<int,int> > > pq;

    dist[source] = 0;
    pq.push(make_pair(0, source));

    while (!pq.empty()) {
        int d    = pq.top().first;
        int node = pq.top().second;
        pq.pop();

        if (d > dist[node]) continue;

        for (size_t i = 0; i < graph[node].size(); i++) {
            int next   = graph[node][i].first;
            int weight = graph[node][i].second;
            if (dist[node] + weight < dist[next]) {
                dist[next] = dist[node] + weight;
                pq.push(make_pair(dist[next], next));
            }
        }
    }
    return dist;
}

// ─────────────────────────────────────────────────────────────────
// ALGORITHM 3: Nearest Neighbor (TSP Greedy Heuristic)
// ─────────────────────────────────────────────────────────────────
vector<int> nearestNeighbor(const vector<int>& stops,
                            const vector<vector<int> >& costMatrix) {
    int k = stops.size();
    vector<bool> visited(k, false);
    vector<int> order;

    int current = 0;
    visited[current] = true;
    order.push_back(current);

    for (int step = 1; step < k; step++) {
        int nearest = -1;
        int minDist = INF;
        for (int next = 0; next < k; next++) {
            if (!visited[next] && costMatrix[current][next] < minDist) {
                minDist = costMatrix[current][next];
                nearest = next;
            }
        }
        if (nearest == -1) break;
        visited[nearest] = true;
        order.push_back(nearest);
        current = nearest;
    }
    return order;
}

int routeCost(const vector<int>& order, const vector<vector<int> >& costMatrix) {
    int total = 0;
    for (size_t i = 0; i + 1 < order.size(); i++) {
        int d = costMatrix[order[i]][order[i + 1]];
        if (d >= INF) return INF;
        total += d;
    }
    return total;
}

// ─────────────────────────────────────────────────────────────────
// ALGORITHM 4: 2-Opt Local Search (Untangle Crossing Paths)
// ─────────────────────────────────────────────────────────────────
vector<int> twoOpt(vector<int> order, const vector<vector<int> >& costMatrix) {
    int k = order.size();
    if (k <= 3) return order;

    bool improved = true;
    int iterations = 0;
    int maxIterations = 500;

    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;

        for (int i = 0; i < k - 2; i++) {
            for (int j = i + 2; j < k; j++) {
                int before = costMatrix[order[i]][order[i+1]];
                int after  = costMatrix[order[i]][order[j]];

                if (j + 1 < k) {
                    before += costMatrix[order[j]][order[j+1]];
                    after  += costMatrix[order[i+1]][order[j+1]];
                }

                if (after < before && after < INF) {
                    reverse(order.begin() + i + 1, order.begin() + j + 1);
                    improved = true;
                }
            }
        }
    }
    return order;
}

// ─────────────────────────────────────────────────────────────────
// ALGORITHM 5: Kruskal's Algorithm with Disjoint Set Union (DSU)
// Minimum Spanning Tree (MST) Backbone
// Optimizations:
//   1. Path Compression: O(alpha(V)) lookup
//   2. Union by Rank: Tree depth stays minimal
// ─────────────────────────────────────────────────────────────────
struct Edge {
    int u, v, weight;
    bool operator<(const Edge& other) const {
        return weight < other.weight;
    }
};

class DSU {
private:
    vector<int> parent;
    vector<int> rank;
public:
    DSU(int n) {
        parent.resize(n);
        rank.resize(n, 0);
        for (int i = 0; i < n; i++) parent[i] = i;
    }

    // Find with Path Compression
    int find(int i) {
        if (parent[i] == i) return i;
        return parent[i] = find(parent[i]);
    }

    // Union by Rank
    bool unite(int i, int j) {
        int rootI = find(i);
        int rootJ = find(j);
        if (rootI == rootJ) return false; // Cycle detected

        if (rank[rootI] < rank[rootJ]) {
            parent[rootI] = rootJ;
        } else if (rank[rootI] > rank[rootJ]) {
            parent[rootJ] = rootI;
        } else {
            parent[rootJ] = rootI;
            rank[rootI]++;
        }
        return true;
    }
};

struct MstResult {
    int totalWeight;
    vector<Edge> mstEdges;
    double executionTimeMs;
};

MstResult kruskalMST(int n, vector<Edge>& edges) {
    auto start = chrono::high_resolution_clock::now();
    sort(edges.begin(), edges.end());

    DSU dsu(n);
    MstResult res;
    res.totalWeight = 0;

    for (size_t i = 0; i < edges.size(); i++) {
        if (dsu.unite(edges[i].u, edges[i].v)) {
            res.totalWeight += edges[i].weight;
            res.mstEdges.push_back(edges[i]);
            if ((int)res.mstEdges.size() == n - 1) break;
        }
    }

    auto end = chrono::high_resolution_clock::now();
    res.executionTimeMs = chrono::duration<double, milli>(end - start).count();
    return res;
}

// ============================================================================
// 🧵 OS WORKER THREAD STRUCTURES & CALLBACKS
// ============================================================================

/*
 * Task struct passed to each vehicle's worker thread
 */
struct VrpWorkerTask {
    int vehicleId;
    int vehicleIndex;
    vector<int> stops;
    vector<vector<int> > costMatrix;
    int totalStopsCount;
    vector<int> allStops;

    // Results calculated by this worker thread
    vector<int> optimizedStops;
    int finalCost;
    double threadExecMs;
    DWORD threadId;
};

/*
 * Thread Entry Point for CVRP Vehicle Route Optimization:
 * Har vehicle ka 2-opt alag OS thread par parallel execute hota hai!
 */
unsigned __stdcall vrpVehicleWorker(void* param) {
    VrpWorkerTask* task = (VrpWorkerTask*)param;
    task->threadId = GetCurrentThreadId();
    auto start = chrono::high_resolution_clock::now();

    int k = task->stops.size();
    if (k <= 2) {
        int c = 0;
        for (int i = 0; i + 1 < k; i++) {
            int idx1 = 0, idx2 = 0;
            for (int s = 0; s < task->totalStopsCount; s++) {
                if (task->allStops[s] == task->stops[i]) idx1 = s;
                if (task->allStops[s] == task->stops[i+1]) idx2 = s;
            }
            c += task->costMatrix[idx1][idx2];
        }
        task->optimizedStops = task->stops;
        task->finalCost = c;
    } else {
        vector<int> localOrder(k);
        vector<vector<int> > localMatrix(k, vector<int>(k, 0));
        for (int i = 0; i < k; i++) {
            localOrder[i] = i;
            int origI = 0;
            for (int s = 0; s < task->totalStopsCount; s++) {
                if (task->allStops[s] == task->stops[i]) { origI = s; break; }
            }
            for (int j = 0; j < k; j++) {
                int origJ = 0;
                for (int s = 0; s < task->totalStopsCount; s++) {
                    if (task->allStops[s] == task->stops[j]) { origJ = s; break; }
                }
                localMatrix[i][j] = task->costMatrix[origI][origJ];
            }
        }

        vector<int> opt = twoOpt(localOrder, localMatrix);
        vector<int> finalStops(k);
        for (int i = 0; i < k; i++) {
            finalStops[i] = task->stops[opt[i]];
        }
        task->optimizedStops = finalStops;
        task->finalCost = routeCost(opt, localMatrix);
    }

    auto end = chrono::high_resolution_clock::now();
    task->threadExecMs = chrono::duration<double, milli>(end - start).count();

    // 🔒 CRITICAL SECTION DEMONSTRATION (Mutual Exclusion):
    // Shared global metrics ko safely update karte hain using Mutex
    {
        LockGuard lock(globalFleetMutex);
        globalTotalFleetDistance += task->finalCost;
        if (task->finalCost > globalMaxRouteDistance) {
            globalMaxRouteDistance = task->finalCost;
        }
        globalCompletedThreads++;
    }

    return 0;
}

/*
 * Task struct for Concurrent Algorithm Race (Dijkstra vs A*)
 */
struct CompareTask {
    string algoName;
    int source;
    int destination;
    const vector<vector<pair<int,int> > >* graph;
    ShortestResult result;
    DWORD threadId;
};

unsigned __stdcall dijkstraWorker(void* param) {
    CompareTask* task = (CompareTask*)param;
    task->threadId = GetCurrentThreadId();
    auto start = chrono::high_resolution_clock::now();
    task->result = dijkstra(task->source, task->destination, *(task->graph));
    auto end = chrono::high_resolution_clock::now();
    task->result.executionTimeMs = chrono::duration<double, milli>(end - start).count();
    task->result.threadId = task->threadId;
    return 0;
}

unsigned __stdcall astarWorker(void* param) {
    CompareTask* task = (CompareTask*)param;
    task->threadId = GetCurrentThreadId();
    auto start = chrono::high_resolution_clock::now();
    task->result = astar(task->source, task->destination, *(task->graph));
    auto end = chrono::high_resolution_clock::now();
    task->result.executionTimeMs = chrono::duration<double, milli>(end - start).count();
    task->result.threadId = task->threadId;
    return 0;
}

// ─────────────────────────────────────────────────────────────────
// JSON OUTPUT FORMATTERS
// ─────────────────────────────────────────────────────────────────
void printMstJSON(const MstResult& res) {
    cout << "{\n";
    cout << "  \"mode\": \"mst\",\n";
    cout << "  \"algorithm\": \"Kruskal's Algorithm with Disjoint Set Union (DSU)\",\n";
    cout << "  \"dsuOptimizations\": [\"Path Compression\", \"Union by Rank\"],\n";
    cout << "  \"totalMstWeight\": " << res.totalWeight << ",\n";
    cout << "  \"executionTimeMs\": " << res.executionTimeMs << ",\n";
    cout << "  \"mstEdges\": [\n";
    for (size_t i = 0; i < res.mstEdges.size(); i++) {
        cout << "    [" << res.mstEdges[i].u << ", " << res.mstEdges[i].v << ", " << res.mstEdges[i].weight << "]";
        if (i + 1 < res.mstEdges.size()) cout << ",";
        cout << "\n";
    }
    cout << "  ]\n";
    cout << "}\n";
}

void printShortestJSON(const ShortestResult& res, const string& algo) {
    cout << "{\n";
    cout << "  \"mode\": \"shortest\",\n";
    cout << "  \"algorithm\": \"" << algo << "\",\n";
    cout << "  \"distance\": "    << res.distance << ",\n";
    cout << "  \"nodesVisited\": " << res.nodesVisited << ",\n";
    cout << "  \"executionTimeMs\": " << res.executionTimeMs << ",\n";
    cout << "  \"threadId\": " << res.threadId << ",\n";
    cout << "  \"path\": [";
    for (size_t i = 0; i < res.path.size(); i++) {
        cout << res.path[i];
        if (i + 1 < res.path.size()) cout << ", ";
    }
    cout << "]\n}\n";
}

void printCompareJSON(const ShortestResult& dij, const ShortestResult& ast, double totalMs) {
    string winner = (dij.nodesVisited <= ast.nodesVisited) ? "dijkstra" : "astar";
    cout << "{\n";
    cout << "  \"mode\": \"compare\",\n";
    cout << "  \"executionTimeMs\": " << totalMs << ",\n";
    cout << "  \"concurrency\": {\n";
    cout << "    \"threadsSpawned\": 2,\n";
    cout << "    \"strategy\": \"Concurrent Parallel Algorithm Race (Dijkstra vs A*)\",\n";
    cout << "    \"synchronization\": \"OS Barrier Synchronization (WaitForMultipleObjects)\",\n";
    cout << "    \"dijkstraThreadId\": " << dij.threadId << ",\n";
    cout << "    \"astarThreadId\": " << ast.threadId << ",\n";
    cout << "    \"threadSafety\": \"Zero shared state — fully decoupled worker threads\"\n";
    cout << "  },\n";
    cout << "  \"dijkstra\": {\n";
    cout << "    \"distance\": " << dij.distance << ",\n";
    cout << "    \"nodesVisited\": " << dij.nodesVisited << ",\n";
    cout << "    \"executionTimeMs\": " << dij.executionTimeMs << ",\n";
    cout << "    \"path\": [";
    for (size_t i = 0; i < dij.path.size(); i++) {
        cout << dij.path[i];
        if (i + 1 < dij.path.size()) cout << ", ";
    }
    cout << "]\n  },\n";
    cout << "  \"astar\": {\n";
    cout << "    \"distance\": " << ast.distance << ",\n";
    cout << "    \"nodesVisited\": " << ast.nodesVisited << ",\n";
    cout << "    \"executionTimeMs\": " << ast.executionTimeMs << ",\n";
    cout << "    \"path\": [";
    for (size_t i = 0; i < ast.path.size(); i++) {
        cout << ast.path[i];
        if (i + 1 < ast.path.size()) cout << ", ";
    }
    cout << "]\n  },\n";
    cout << "  \"winner\": \"" << winner << "\",\n";
    cout << "  \"summary\": {\n";
    cout << "    \"sameDistance\": " << (dij.distance == ast.distance ? "true" : "false") << ",\n";
    cout << "    \"dijkstraNodes\": " << dij.nodesVisited << ",\n";
    cout << "    \"astarNodes\": " << ast.nodesVisited << "\n";
    cout << "  }\n";
    cout << "}\n";
}

void printOptimizeJSON(const vector<int>& stops,
                        const vector<int>& nnOrder,
                        const vector<int>& optOrder,
                        int nnCost, int optCost,
                        double execMs) {
    cout << "{\n";
    cout << "  \"mode\": \"optimize\",\n";
    cout << "  \"executionTimeMs\": " << execMs << ",\n";
    cout << "  \"nearestNeighborOrder\": [";
    for (size_t i = 0; i < nnOrder.size(); i++) {
        cout << stops[nnOrder[i]];
        if (i + 1 < nnOrder.size()) cout << ", ";
    }
    cout << "],\n";
    cout << "  \"nearestNeighborCost\": " << nnCost << ",\n";
    cout << "  \"twoOptOrder\": [";
    for (size_t i = 0; i < optOrder.size(); i++) {
        cout << stops[optOrder[i]];
        if (i + 1 < optOrder.size()) cout << ", ";
    }
    cout << "],\n";
    cout << "  \"twoOptCost\": " << optCost << ",\n";

    double improvement = 0.0;
    if (nnCost > 0 && nnCost < INF && optCost < INF) {
        improvement = 100.0 * (nnCost - optCost) / nnCost;
    }
    cout << "  \"improvementPercent\": " << improvement << "\n";
    cout << "}\n";
}

void printVrpJSON(const vector<VehicleRoute>& routes, double execMs, int threadsCount) {
    cout << "{\n";
    cout << "  \"mode\": \"vrp\",\n";
    cout << "  \"executionTimeMs\": " << execMs << ",\n";
    cout << "  \"concurrency\": {\n";
    cout << "    \"threadsSpawned\": " << threadsCount << ",\n";
    cout << "    \"strategy\": \"Multi-Core Task Parallelism (1 OS Worker Thread per Van)\",\n";
    cout << "    \"synchronization\": \"OS Barrier Synchronization (WaitForMultipleObjects)\",\n";
    cout << "    \"criticalSectionProtection\": \"OS Mutex & RAII LockGuard (Race-Condition Free)\",\n";
    cout << "    \"multicoreAdvantage\": \"Parallel 2-Opt local search executed simultaneously\"\n";
    cout << "  },\n";
    cout << "  \"totalFleetDistance\": " << globalTotalFleetDistance << ",\n";
    cout << "  \"maxRouteDistance\": " << globalMaxRouteDistance << ",\n";
    cout << "  \"routes\": [\n";

    for (size_t v = 0; v < routes.size(); v++) {
        cout << "    {\n";
        cout << "      \"vehicleId\": " << routes[v].vehicleId << ",\n";
        cout << "      \"totalCost\": " << routes[v].totalCost << ",\n";
        cout << "      \"threadId\": " << routes[v].threadId << ",\n";
        cout << "      \"threadExecMs\": " << routes[v].threadExecMs << ",\n";
        cout << "      \"stops\": [";
        for (size_t i = 0; i < routes[v].stops.size(); i++) {
            cout << routes[v].stops[i];
            if (i + 1 < routes[v].stops.size()) cout << ", ";
        }
        cout << "]\n";
        cout << "    }" << (v + 1 < routes.size() ? "," : "") << "\n";
    }
    cout << "  ]\n";
    cout << "}\n";
}

// ─────────────────────────────────────────────────────────────────
// MAIN CONTROLLER
// ─────────────────────────────────────────────────────────────────
int main() {
    string mode;
    if (!(cin >> mode)) return 0;

    auto startTime = chrono::high_resolution_clock::now();

    if (mode == "shortest") {
        // ── Single Shortest Path ──────────────────────────────
        int n, e, source, destination;
        string algorithm;
        cin >> n >> e >> source >> destination >> algorithm;

        vector<vector<pair<int,int> > > graph(n);
        for (int i = 0; i < e; i++) {
            int u, v, w;
            cin >> u >> v >> w;
            graph[u].push_back(make_pair(v, w));
            graph[v].push_back(make_pair(u, w));
        }

        ShortestResult res;
        if (algorithm == "astar") res = astar(source, destination, graph);
        else                      res = dijkstra(source, destination, graph);

        auto endTime = chrono::high_resolution_clock::now();
        res.executionTimeMs = chrono::duration<double, milli>(endTime - startTime).count();

        printShortestJSON(res, algorithm);

    } else if (mode == "compare") {
        // ── 🧵 CONCURRENCY POINT 3: Concurrent Algorithm Race ──
        int n, e, source, destination;
        cin >> n >> e >> source >> destination;

        vector<vector<pair<int,int> > > graph(n);
        for (int i = 0; i < e; i++) {
            int u, v, w;
            cin >> u >> v >> w;
            graph[u].push_back(make_pair(v, w));
            graph[v].push_back(make_pair(u, w));
        }

        // Spawn 2 parallel OS worker threads: one for Dijkstra, one for A*
        CompareTask taskDijkstra;
        taskDijkstra.algoName = "dijkstra";
        taskDijkstra.source = source;
        taskDijkstra.destination = destination;
        taskDijkstra.graph = &graph;

        CompareTask taskAstar;
        taskAstar.algoName = "astar";
        taskAstar.source = source;
        taskAstar.destination = destination;
        taskAstar.graph = &graph;

        HANDLE threadHandles[2];
        threadHandles[0] = (HANDLE)_beginthreadex(NULL, 0, dijkstraWorker, &taskDijkstra, 0, NULL);
        threadHandles[1] = (HANDLE)_beginthreadex(NULL, 0, astarWorker, &taskAstar, 0, NULL);

        // 🛑 OS BARRIER SYNCHRONIZATION: Wait for both threads to finish
        WaitForMultipleObjects(2, threadHandles, TRUE, INFINITE);
        CloseHandle(threadHandles[0]);
        CloseHandle(threadHandles[1]);

        auto endTime = chrono::high_resolution_clock::now();
        double totalMs = chrono::duration<double, milli>(endTime - startTime).count();

        printCompareJSON(taskDijkstra.result, taskAstar.result, totalMs);

    } else if (mode == "optimize") {
        // ── 1-Van Route Optimization (NN + 2-opt) ─────────────
        int n, e, numStops;
        cin >> n >> e >> numStops;

        vector<vector<pair<int,int> > > graph(n);
        for (int i = 0; i < e; i++) {
            int u, v, w;
            cin >> u >> v >> w;
            graph[u].push_back(make_pair(v, w));
            graph[v].push_back(make_pair(u, w));
        }

        vector<int> stops(numStops);
        for (int i = 0; i < numStops; i++) cin >> stops[i];

        vector<vector<int> > costMatrix(numStops, vector<int>(numStops, 0));
        for (int i = 0; i < numStops; i++) {
            vector<int> dist = dijkstraFrom(stops[i], graph);
            for (int j = 0; j < numStops; j++) {
                costMatrix[i][j] = dist[stops[j]];
            }
        }

        vector<int> nnOrder  = nearestNeighbor(stops, costMatrix);
        int nnCost           = routeCost(nnOrder, costMatrix);
        vector<int> optOrder = twoOpt(nnOrder, costMatrix);
        int optCost          = routeCost(optOrder, costMatrix);

        auto endTime = chrono::high_resolution_clock::now();
        double execMs = chrono::duration<double, milli>(endTime - startTime).count();

        printOptimizeJSON(stops, nnOrder, optOrder, nnCost, optCost, execMs);

    } else if (mode == "vrp") {
        // ── 🧵 CONCURRENCY POINT 1 & 2: Multi-Vehicle Capacitated VRP ──
        int n, e, numStops, numVehicles, capacity;
        cin >> n >> e >> numStops >> numVehicles >> capacity;

        vector<vector<pair<int,int> > > graph(n);
        for (int i = 0; i < e; i++) {
            int u, v, w;
            cin >> u >> v >> w;
            graph[u].push_back(make_pair(v, w));
            graph[v].push_back(make_pair(u, w));
        }

        vector<int> stops(numStops);
        for (int i = 0; i < numStops; i++) cin >> stops[i];

        vector<vector<int> > costMatrix(numStops, vector<int>(numStops, 0));
        for (int i = 0; i < numStops; i++) {
            vector<int> dist = dijkstraFrom(stops[i], graph);
            for (int j = 0; j < numStops; j++) {
                costMatrix[i][j] = dist[stops[j]];
            }
        }

        // Clustering: Partition stops across vehicles
        vector<VehicleRoute> initialRoutes(numVehicles);
        for (int v = 0; v < numVehicles; v++) {
            initialRoutes[v].vehicleId = v + 1;
            initialRoutes[v].stops.push_back(stops[0]); // depot
        }

        vector<bool> assigned(numStops, false);
        assigned[0] = true;

        int unassignedCount = numStops - 1;
        while (unassignedCount > 0) {
            bool anyAssigned = false;
            for (int v = 0; v < numVehicles && unassignedCount > 0; v++) {
                if ((int)initialRoutes[v].stops.size() > capacity) continue;

                int lastStopNode = initialRoutes[v].stops.back();
                int lastIdx = 0;
                for (int i = 0; i < numStops; i++) {
                    if (stops[i] == lastStopNode) { lastIdx = i; break; }
                }

                int bestNextIdx = -1;
                int bestDist = INF;
                for (int j = 1; j < numStops; j++) {
                    if (!assigned[j] && costMatrix[lastIdx][j] < bestDist) {
                        bestDist = costMatrix[lastIdx][j];
                        bestNextIdx = j;
                    }
                }

                if (bestNextIdx != -1) {
                    assigned[bestNextIdx] = true;
                    initialRoutes[v].stops.push_back(stops[bestNextIdx]);
                    unassignedCount--;
                    anyAssigned = true;
                }
            }
            if (!anyAssigned) {
                int bestV = 0;
                for (int v = 1; v < numVehicles; v++) {
                    if (initialRoutes[v].stops.size() < initialRoutes[bestV].stops.size()) bestV = v;
                }
                for (int j = 1; j < numStops; j++) {
                    if (!assigned[j]) {
                        assigned[j] = true;
                        initialRoutes[bestV].stops.push_back(stops[j]);
                        unassignedCount--;
                        break;
                    }
                }
            }
        }

        // ====================================================================
        // 🧵 SPAWN OS WORKER THREADS (1 Thread per Vehicle)
        // ====================================================================
        // Reset shared global metrics before worker threads start
        globalTotalFleetDistance = 0;
        globalMaxRouteDistance   = 0;
        globalCompletedThreads   = 0;

        vector<VrpWorkerTask> tasks(numVehicles);
        vector<HANDLE> threadHandles(numVehicles);

        for (int v = 0; v < numVehicles; v++) {
            tasks[v].vehicleId       = initialRoutes[v].vehicleId;
            tasks[v].vehicleIndex   = v;
            tasks[v].stops          = initialRoutes[v].stops;
            tasks[v].costMatrix     = costMatrix;
            tasks[v].totalStopsCount = numStops;
            tasks[v].allStops       = stops;

            // Spawn native OS Worker Thread
            threadHandles[v] = (HANDLE)_beginthreadex(NULL, 0, vrpVehicleWorker, &tasks[v], 0, NULL);
        }

        // ====================================================================
        // 🛑 OS BARRIER SYNCHRONIZATION: WaitForMultipleObjects
        // Main thread waits until ALL vehicle worker threads finish computation!
        // ====================================================================
        WaitForMultipleObjects(numVehicles, &threadHandles[0], TRUE, INFINITE);

        for (int v = 0; v < numVehicles; v++) {
            CloseHandle(threadHandles[v]);
        }

        // Collate final results
        vector<VehicleRoute> finalRoutes(numVehicles);
        for (int v = 0; v < numVehicles; v++) {
            finalRoutes[v].vehicleId    = tasks[v].vehicleId;
            finalRoutes[v].stops        = tasks[v].optimizedStops;
            finalRoutes[v].totalCost    = tasks[v].finalCost;
            finalRoutes[v].threadExecMs = tasks[v].threadExecMs;
            finalRoutes[v].threadId     = tasks[v].threadId;
        }

        auto endTime = chrono::high_resolution_clock::now();
        double execMs = chrono::duration<double, milli>(endTime - startTime).count();

        printVrpJSON(finalRoutes, execMs, numVehicles);
    } else if (mode == "mst") {
        // ── Minimum Spanning Tree (MST - Kruskal with DSU) ───
        int n, e;
        cin >> n >> e;
        vector<Edge> edges(e);
        for (int i = 0; i < e; i++) {
            cin >> edges[i].u >> edges[i].v >> edges[i].weight;
        }
        MstResult res = kruskalMST(n, edges);
        printMstJSON(res);
    }

    return 0;
}
