# SyncRoute: traffic signals that work together

Research checked on 24 October 2026. The project is currently a browser simulation; the learning system and field deployment described below are proposed next stages.

## A pitch to present

Think about the roads near us during Diwali: one approach has a long queue, another is almost empty, and a traffic light can keep following the same timetable. A fixed schedule cannot respond to every sudden change in demand. When nearby junctions act independently, releasing one queue can simply move it to the next junction.

The cost is time people cannot get back. In TomTom's **2025 traffic data**, Bengaluru ranked **second worldwide by congestion level**, at **74.4%**. Its published rush-hour measure estimates **168 hours lost in a year**, approximately seven full days. This is an estimate for a standard commute, based on two 10 km peak-hour trips on 230 working days; it is not a measurement of every resident's experience. [TomTom's global analysis](https://www.tomtom.com/newsroom/explainers-and-insights/tomtom-traffic-index-2026-headline-numbers/), [Bengaluru data](https://www.tomtom.com/traffic-index/city/bengaluru/), [methodology](https://www.tomtom.com/traffic-index/about/).

Traffic management already has strong foundations to build on. Europe is deploying Cooperative Intelligent Transport Systems, which exchange information between vehicles and road infrastructure. The C-Roads platform reported more than 6,000 roadside units in its February 2026 deployment snapshot. India also has much more than CCTV: NHAI's ATMS includes incident detection and response, while C-DAC's systems support adaptive signals and India has developed conditional bus signal priority. Our opportunity is to connect sensing, neighbouring junction decisions and route advice around measurable local needs. [C-Roads](https://www.c-roads.eu/), [NHAI's ATMS description](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2042493), [C-DAC adaptive controller](https://cdac.gov.in/index.aspx?id=product_details&productId=WiTraC%28WirelessTrafficControlSystem%29), [India's bus priority initiative](https://www.pib.gov.in/PressReleasePage.aspx?PRID=1815565).

**SyncRoute proposes a shared traffic picture using H3, the geospatial indexing system developed at Uber.** H3 gives each area a consistent cell ID so we can combine traffic observations, weather and incident information. H3 organises the data; cellular networks, fibre and approved roadside communication carry the messages. Junctions and connected roads remain the control network, because a hexagon boundary is not a road intersection. [Official H3 documentation](https://h3geo.org/docs/).

Vehicles that opt in, participating bus fleets and roadside sensors can contribute speed and location observations. We combine them with vehicle counts, queue estimates, downstream road space, weather and verified incidents. We do not need every car to have a connected device: coverage and uncertainty are part of every decision, and infrastructure sensing includes road users who do not use an app.

Using **cooperative multi-agent reinforcement learning**, our proposed system would adjust safe signal timings, **coordinate routes across adjacent H3 areas**, **create emergency green corridors**, and **give conditional priority to buses**. Each junction agent would consider its own queues and its neighbours' receiving space, so clearing one junction does not overload the next. A city operations centre would coordinate corridors and supervise the system, while local controllers would enforce approved phases and clearance intervals.

For drivers, the goal is less unpredictable waiting and route suggestions that account for conditions ahead. For bus passengers, it is more reliable arrivals. For emergency services, it is a cleared corridor with safe recovery afterwards. Pedestrian crossings and side roads need guaranteed service, and residential streets need protection from excessive diversion. Success means moving people safely and reliably, not merely increasing car speed.

Our existing prototype makes these ideas visible in a detailed 3D Connaught Place map. It runs fixed and adaptive controllers against the same seeded traffic, shows emerging congestion in yellow before established congestion turns red, logs signal and route decisions, and exports results for review. **Today's adaptive controller uses explicit rules and an occupancy trend; it is not a trained reinforcement-learning model.** Cars, bikes and buses are rendered separately, but their current movement uses the same simplified logical lane model.

The next practical step is a measured corridor pilot: calibrate a richer simulator from actual traffic, compare learning against strong existing controllers, then run the model in shadow mode before any authorised road trial. We would publish completed trips, unfinished demand, average and worst-case delay, bus reliability and emergency travel time together. Any claimed reduction must come from those measurements. The objective is a city that anticipates congestion and coordinates a response before queues spread.

## The missing words, completed

> Using **cooperative multi-agent reinforcement learning**, we propose dynamically changing traffic-light timings to reduce congestion, managing routes across nearby hexagonal areas, **creating safe emergency green corridors**, and **providing conditional bus priority**.

Use “propose” or “plan to” for learning and deployment. For the current working application, say “using a deterministic adaptive controller with preventive congestion rules.”

## Useful follow-on services

| User | Proposed service | Evidence needed before claiming benefit |
| --- | --- | --- |
| Commuter | Congestion-aware route alternatives and departure windows | Door-to-door reliability and added distance, including diversions |
| Bus passenger/operator | Conditional priority for late or crowded services | Person-delay, punctuality and cross-street impact |
| Emergency dispatcher | Verified corridor requests and progress monitoring | Corridor travel time, safe clearance and recovery delay |
| Pedestrian or cyclist | Protected service windows and crossing wait limits | Crossing service, maximum wait and conflict review |
| Local resident | Limits on diversion through sensitive streets | Neighbourhood traffic volumes and queue spillover |
| Traffic operator | Incident triage, decision explanations and override | Detection quality, response time and reliable rollback |
| City planner | Before/after analysis of closures and festival plans | Calibrated scenarios, representative days and independent validation |

Better signals cannot create unlimited road capacity. Public transport, walking, cycling, parking management and land-use planning remain part of the response. The implementation and evaluation plan is in [REAL_WORLD_ROADMAP.md](REAL_WORLD_ROADMAP.md).
