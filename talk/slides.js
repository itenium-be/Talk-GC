GC.slides = [
  {
    type: 'title', kicker: 'itenium tech session', title: 'Stop the<br>World', subtitle: 'A step-by-step tour of garbage collection',
    footer: 'Use → or a clicker. Every diagram is a live, step-by-step animation.',
    notes: 'All feedback is welcome!\nFormat: theory, but every concept is followed by a step-by-step visualization of what the GC actually does.',
  },
  {
    type: 'bullets', kicker: 'menu', title: 'Today', reveal: true,
    items: ['<b>What</b> is garbage?', '<b>Why</b> bother — and why not', '<b>How</b>: the strategies, one animation at a time', '<b>Java vs .NET</b>: collectors, generations, references', '<b>Winner?</b>'],
    notes: 'Winner: and then we force all our consultants to switch to the winning language.',
  },

  { type: 'section', n: '01', title: 'What', subtitle: 'is garbage, exactly?' },
  {
    type: 'bullets', kicker: 'what', title: 'Automatic memory management',
    items: ['Since <b>1959</b>: John McCarthy, Lisp', 'Reclaims <b>memory</b> — not files, sockets, DB connections, handles', 'Generally <b>non-deterministic</b>: you don’t decide when', 'Targets <b>syntactic</b> garbage'],
    aside: '<b>John McCarthy</b> also coined “artificial intelligence” and co-designed ALGOL.<br><br>Things a GC will <b>not</b> close for you: windows, device handles, locks, network connections.',
    notes: 'Invented by John McCarthy (coined "AI", Lisp, ALGOL).\nNot handled: files, network, db, windows (UI elements), device descriptors, …',
  },
  { type: 'viz', kicker: 'what', title: 'Syntactic vs semantic garbage', scene: 'garbage-kinds', lang: 'dotnet', notes: 'Syntactic garbage: main focus for GCs.\nSemantic garbage: active research area — undecidable in general.\nJIT liveness: in Release builds, a local can be considered dead after its last use, even if the variable is still in scope. GC.KeepAlive(x) / Reference.reachabilityFence(x) extend it.' },
  {
    type: 'bullets', kicker: 'what', title: 'Who has one?', cols: true,
    items: ['<b>Manual</b><small>C, C++ (malloc/free, new/delete, RAII)</small>', '<b>Ownership</b><small>Rust: compile-time, no runtime GC</small>', '<b>Reference counting</b><small>Swift & ObjC (ARC), Python (+ cycle collector), PHP</small>', '<b>Tracing GC</b><small>Java, .NET, Go, JavaScript, Haskell, …</small>', '<b>Hybrid</b><small>D, C++/CLI, Ada: managed and manual heaps</small>', '<b>Bolt-on</b><small>Boehm GC: conservative collector for C/C++</small>'],
    notes: 'Delphi: limited reference counting (strings, interfaces).\nC++/CLI: separate heaps for managed (gcnew) and native (new).\nBoehm: mark & sweep, generational, incremental, finalizers. Was used by Mono.\nARC was Apple’s answer after GC in Objective-C 2.0 (2007) was deprecated in 2012.',
  },

  { type: 'section', n: '02', title: 'Why', subtitle: 'memory management is hard' },
  {
    type: 'statement', big: '<em>~70%</em> of security fixes are memory-safety bugs.', small: 'Microsoft (all products) and Google Chrome both reported it. About half of Chrome’s are use-after-free. Since 2023, CISA, NSA and friends push memory-safe languages.',
    notes: 'Microsoft: Matt Miller, BlueHat IL 2019.\nChrome: 2020, ~70% of high/critical bugs; half of those are use-after-free.\nA GC won’t save you from everything: races, null references, resource leaks remain.',
  },
  { type: 'viz', kicker: 'why', title: 'What’s the worst that can happen?', scene: 'use-after-free', lang: 'c', notes: 'malloc: search the free list (first fit), split the block, write a header in front. Not found: ask the OS for more (sbrk/mmap).\nfree: put the block back on the free list.\n"moreThan3" is 9 characters + the null terminator = 10 bytes.\nReal exploits: overwrite heap metadata or a vtable pointer / function pointer in the neighbour.' },

  { type: 'section', n: '03', title: 'Why not', subtitle: 'TANSTAAFL — there ain’t no such thing as a free lunch' },
  {
    type: 'bullets', kicker: 'why not', title: 'The bill', reveal: true,
    items: ['<b>Memory</b><small>a GC needs headroom to be fast</small>', '<b>CPU</b><small>marking, copying, barriers on every pointer write (and read)</small>', '<b>Pauses</b><small>stop-the-world: “the embarrassing pause”</small>', '<b>Unpredictability</b><small>real-time & embedded need special collectors</small>'],
    aside: '<b>Hertz & Berger, 2005</b><br>Matching explicit memory management:<br>• 5× the memory → same speed<br>• 3× → 17% slower<br>• 2× → 70% slower',
    notes: 'iOS: GC added to Objective-C 2.0 (2007), deprecated 2012 for ARC, not allowed for new apps from 2015 — responsiveness.\nReal-time: Metronome (IBM WebSphere Real Time), Staccato.\nEmbedded with GC: .NET nanoFramework, Java ME.',
  },

  { type: 'section', n: '04', title: 'How', subtitle: 'strategies — step by step' },
  { type: 'viz', kicker: 'strategy', title: 'Escape analysis', scene: 'escape', lang: 'both', notes: 'Java: -XX:+DoEscapeAnalysis (default on). NoEscape → scalar replacement; ArgEscape → lock elision; GlobalEscape → heap.\nV8 does it too.\n.NET: the old note said "partial, working on it" (dotnet/runtime#11192). .NET 9 started stack-allocating objects, .NET 10 extended it (small arrays, delegates, …).' },
  { type: 'viz', kicker: 'strategy', title: 'Reference counting', scene: 'refcount', notes: 'Used by: Swift/ObjC ARC, Python, PHP, Perl, C++ shared_ptr, Rust Rc/Arc, COM, file systems (hard links), distributed systems (tracing a cluster is too slow).\nCycle fix: weak refs, or a backup tracing collector.' },
  { type: 'viz', kicker: 'tracing', title: 'Mark & Sweep', scene: 'mark-sweep', notes: 'Tracing: objects not reachable from the roots are garbage.\nRoots: stack slots, statics, registers, GC handles, finalizer queue, JNI/P-Invoke handles.\nNaive mark & sweep: halts everything, touches the whole heap.\nNon-moving → fragmentation → allocation has to search a free list.' },
  { type: 'viz', kicker: 'tracing', title: 'Mark & Compact', scene: 'mark-compact', notes: 'Moving / compacting: extra work — update all references — but allocation becomes a pointer bump and the cache loves contiguous objects.\nThis is why .NET needs fixed/pinning when you hand a pointer to native code.\nJava old gen (Serial/Parallel), .NET gen2 (when it decides to compact).' },
  { type: 'viz', kicker: 'tracing', title: 'Copying collector', scene: 'copying', notes: 'Cheney 1970: breadth-first, no stack needed — the to-space itself is the queue (between scan and free).\nCost proportional to live objects only. Ideal when almost everything is dead: the young generation.' },
  { type: 'viz', kicker: 'tracing', title: 'Tri-color marking', scene: 'tricolor', notes: 'Tri-color invariant: no black object points to a white one.\nThis is what lets a GC mark while the app (the "mutator") runs.\nDijkstra (incremental update): shade the new target on store.\nYuasa / SATB (snapshot at the beginning): shade the old value on overwrite. G1, Shenandoah.\nZGC: load barriers + colored pointers.' },
  {
    type: 'statement', kicker: 'generations', title: 'The weak generational hypothesis', big: 'Most objects <em>die young</em>.', small: 'So: collect the young often and cheaply (copying: cost ∝ survivors), and the old rarely. Everything that survives long enough gets promoted.',
    notes: 'Infant mortality. If the hypothesis does not hold (caches, pooled objects) objects get promoted — and then die in the old gen, which is the expensive case ("mid-life crisis").',
  },
  { type: 'viz', kicker: 'generations', title: 'Java: Eden, Survivors, Old', scene: 'java-gen', lang: 'java', notes: 'Eden full → minor GC. Survivors go to the empty survivor space; S0/S1 swap every time.\nPromotion: -XX:MaxTenuringThreshold (max 15, adaptive).\nPermGen is gone since JDK 8: class metadata lives in Metaspace (native memory).\nEvacuation failure (no room in survivor/old) can trigger a full GC.' },
  { type: 'viz', kicker: 'generations', title: '.NET: gen0, gen1, gen2, LOH, POH', scene: 'dotnet-gen', lang: 'dotnet', notes: 'gen0 = ephemeral. A gen-N GC also collects all younger generations.\nLOH: sometimes called "gen3", collected with gen2, not compacted by default (GCSettings.LargeObjectHeapCompactionMode = CompactOnce).\nPOH: .NET 5. Pinned arrays for sockets/IO.\n.NET 8: frozen segments (NonGC heap) for string literals, typeof(), static readonly data.\nRegions since .NET 7: memory can be decommitted and moved between generations.' },

  { type: 'section', n: '05', title: 'Java vs .NET', subtitle: 'the collectors' },
  { type: 'viz', kicker: 'implementations', title: 'Who stops the world?', scene: 'timeline', lang: 'both', notes: 'Java started simple (Serial) and learned it needed fewer STW events. .NET started from those lessons; Java caught up and then went further (ZGC, Shenandoah).\nSerial: -XX:+UseSerialGC. Parallel: -XX:+UseParallelGC. G1: default. ZGC: -XX:+UseZGC. Shenandoah: -XX:+UseShenandoahGC.\n.NET: <ServerGarbageCollector>, <ConcurrentGarbageCollection>, DOTNET_GCDynamicAdaptationMode.' },
  {
    type: 'bullets', kicker: 'java', title: 'The JVM menu', lang: 'java', cols: true,
    items: ['<b>Serial</b> <code>-XX:+UseSerialGC</code><small>tiny heaps, small containers</small>', '<b>Parallel</b> <code>-XX:+UseParallelGC</code><small>throughput, batch jobs</small>', '<b>G1</b> (default)<small>balanced: pause goal + throughput</small>', '<b>ZGC</b> <code>-XX:+UseZGC</code><small>sub-ms pauses, generational</small>', '<b>Shenandoah</b><small>sub-ms pauses, Red Hat, generational in 25</small>', '<b>Epsilon</b><small>allocates, never collects. For benchmarks.</small>'],
    notes: 'CMS: removed in JDK 14.\nC4: Azul Zing / Prime — pauseless, generational, concurrent compaction.\nJDK 25 (LTS): compact object headers (JEP 519) — 8-byte headers, less memory, less GC.\nThe JVM picks Serial automatically when it sees < 2 CPUs or < 1792 MB: check your container limits!',
  },
  { type: 'viz', kicker: 'java', title: 'G1: Garbage First', scene: 'g1', lang: 'java', notes: 'Regions: ~2048, 1–32 MB (-XX:G1HeapRegionSize).\nSATB concurrent marking, remembered sets per region.\nMixed GCs: young + old regions with the least live data.\n-XX:MaxGCPauseMillis=200.\nHumongous: ≥ ½ region. Also: string deduplication (-XX:+UseStringDeduplication).' },
  { type: 'viz', kicker: 'java', title: 'ZGC: moving while you run', scene: 'zgc', lang: 'java', notes: 'Colored pointers: metadata bits in the reference (remapped / marked / finalizable).\nLoad barrier on every reference load from the heap; fast path is a test + branch.\nSTW pauses only for root scanning-ish handshakes, not proportional to the heap.\nShenandoah: originally Brooks forwarding pointers, now load-reference barriers.' },
  {
    type: 'bullets', kicker: '.net', title: 'The CLR menu', lang: 'dotnet', cols: true,
    items: ['<b>Workstation</b><small>one heap, low memory. Desktop default.</small>', '<b>Server</b><small>heap + GC thread per core. ASP.NET default.</small>', '<b>Background GC</b><small>concurrent gen2, on by default</small>', '<b>DATAS</b> (.NET 9+)<small>Server GC that scales heaps to the app</small>', '<b>Regions</b> (.NET 7+)<small>replace segments; better memory return</small>', '<b>Knobs</b><small><code>GCHeapHardLimit</code>, <code>GCConserveMemory</code>, <code>GCHeapAffinitizeMask</code></small>'],
    notes: 'Workstation: optimized for latency, Server: for throughput, assumes it can use all cores.\nBackground GC replaced the old "concurrent GC" (.NET Framework 4/4.5).\nDATAS: Dynamic Adaptation To Application Sizes. Great in containers.\nRoots: stack, GC handles, statics.\nFar fewer knobs than the JVM — on purpose.',
  },

  { type: 'section', n: '06', title: 'References & cleanup', subtitle: 'strong, soft, weak, phantom — and finalizers' },
  { type: 'viz', kicker: 'references', title: 'Strong, soft, weak, phantom', scene: 'refs', lang: 'both', notes: '.NET WeakReference: IsAlive, TryGetTarget, SetTarget, TrackResurrection.\nShort weak ref: cleared before finalization. Long (trackResurrection: true): cleared after.\nNo SoftReference in .NET.\nJava WeakHashMap: weak keys. .NET ConditionalWeakTable: ephemeron semantics (value doesn’t keep key alive).' },
  { type: 'viz', kicker: 'cleanup', title: 'Finalization: why it hurts', scene: 'finalize', lang: 'dotnet', notes: 'Finalizers run on a separate thread, not during GC (they could take forever).\nMight never run (process exit). No ordering between objects.\nResurrection: the finalizer can store `this` somewhere — it’s alive again.\nSafeHandle: CriticalFinalizerObject, reference counted against P/Invoke races.\nJava: PhantomReference + ReferenceQueue → Cleaner (JDK 9). finalize() deprecated for removal: JEP 421 (JDK 18), --finalization=disabled.' },
  {
    type: 'compare', kicker: 'cleanup', title: 'Deterministic cleanup',
    java: { title: 'try-with-resources', code: 'try (var r = new FileReader(path)) {\n    return r.read();\n}\n// AutoCloseable.close()\n\nCleaner.create()\n    .register(obj, () -> free(h));' },
    dotnet: { title: 'using / await using', code: 'using var r = new StreamReader(path);\nreturn r.ReadLine();\n// IDisposable.Dispose()\n\nawait using var c = new DbConn();\n// IAsyncDisposable.DisposeAsync()' },
    footer: 'Memory: the GC’s job. Everything else: <b>yours</b>. Don’t write finalizers.',
    notes: 'Java: implement AutoCloseable (Closeable for IO).\n.NET: implement IDisposable / IAsyncDisposable. Don’t write a finalizer yourself — use SafeHandle.',
  },
  {
    type: 'compare', kicker: 'diagnose', title: 'Is GC actually your problem?',
    java: { title: '', html: '<ul><li><code>-Xlog:gc*</code> — unified GC logging</li><li><b>JFR</b> + JDK Mission Control</li><li><code>jstat -gc &lt;pid&gt; 1s</code></li><li>Allocation profiling: async-profiler <code>-e alloc</code></li></ul>' },
    dotnet: { title: '', html: '<ul><li><code>dotnet-counters monitor</code> — % time in GC, gen0/1/2 counts</li><li><code>dotnet-trace</code> / <b>PerfView</b></li><li><code>GC.GetGCMemoryInfo()</code></li><li>Allocation profiling: VS / dotMemory</li></ul>' },
    footer: 'Rule of thumb: a few % of time in GC is fine. The knob you really control is the <b>allocation rate</b>.',
  },

  { type: 'section', n: '07', title: 'Winner?', subtitle: '' },
  {
    type: 'table', kicker: 'winner', title: 'Side by side',
    rows: [
      ['Default collector', 'G1 (generational, regionized)', 'Background GC, Workstation or Server/DATAS'],
      ['Lowest pauses', 'ZGC / Shenandoah: &lt; 1 ms, concurrent compaction', 'Background gen2, compacting pauses remain', 'java'],
      ['Tunability', 'Six collectors, hundreds of flags', 'A handful of settings', 'java'],
      ['Not allocating', 'Escape analysis; Valhalla on its way', '<code>struct</code>, <code>Span&lt;T&gt;</code>, <code>stackalloc</code> + stack allocation in .NET 10', 'dotnet'],
      ['Large objects', 'Humongous regions (G1)', 'LOH + POH'],
      ['References', 'Soft, weak, phantom, Cleaner', 'Weak (short/long), ConditionalWeakTable', 'java'],
      ['Finalization', 'Deprecated for removal', 'Still there; SafeHandle'],
    ],
    notes: 'Lessons learned & Java catching up: string deduplication and humongous regions in G1.\nJava more advanced GC-wise: escape analysis, soft refs, Cleaner/phantom refs, ZGC/Shenandoah/C4.\n.NET simply allocates less: value types, spans.',
  },
  {
    type: 'statement', kicker: 'winner', title: 'Verdict', big: 'Java builds the better <em>garbage collector</em>.<br>.NET makes less <em>garbage</em>.', small: 'Both are excellent. Measure before you tune — and nobody has to switch languages.',
  },
  {
    type: 'bullets', kicker: 'resources', title: 'Further reading',
    items: ['ZDNet: 70% of security bugs are memory-safety issues', 'Simone Bordet: Concurrent GCs — ZGC & Shenandoah', 'Maoni Stephens: .NET GC blog & “mem-doc” (github.com/Maoni0/mem-doc)', 'inside.java: Mark-Scavenge GC', 'Hertz & Berger: Quantifying the Performance of GC vs Explicit Memory Management (2005)', 'The Stack Is an Implementation Detail (Eric Lippert)'],
  },
  { type: 'section', n: '?', title: 'Questions?', subtitle: 'press ← to replay any animation' },
];
