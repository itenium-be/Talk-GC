(() => {
  const { scene } = GC;

  scene('garbage-kinds', {
    lang: 'cs', codeTitle: 'C#',
    code: 'var x = new Foo();\nx = new Bar();\nif (!x.IsValid) return;\nx.DoWork();',
    legend: [['root', 'variable'], ['live', 'reachable'], ['garbage', 'garbage'], ['hot', 'semantic garbage?']],
    init: h => {
      h.region('stack', { x: 40, y: 60, w: 240, h: 520, label: 'Stack', cls: 'stack' });
      h.region('heap', { x: 340, y: 60, w: 620, h: 520, label: 'Heap' });
      h.add('x', { x: 70, y: 150, w: 180, h: 60, label: 'x', sub: 'local variable', cls: 'stack-var' });
    },
    steps: [
      { t: 'Two places. The <b>stack</b> holds variables. The <b>heap</b> holds objects.' },
      { hl: [1], t: '<code>new Foo()</code> lands on the heap. <code>x</code> points to it: Foo is <b>reachable</b>.', do: h => { h.add('Foo', { x: 520, y: 150, w: 180, h: 76, cls: 'live' }); h.ref('x', 'Foo', { cls: 'live' }); } },
      { hl: [2], t: '<code>x</code> now points to Bar. Nobody can ever reach Foo again: <em>syntactic garbage</em>.', do: h => { h.add('Bar', { x: 520, y: 380, w: 180, h: 76, cls: 'live' }); h.unref('x', 'Foo'); h.ref('x', 'Bar', { cls: 'live' }); h.set('Foo', { cls: 'garbage', sub: 'unreachable' }); } },
      { hl: [3], t: 'If <code>IsValid</code> is false, Bar is never used again — yet <code>x</code> still references it. <em>Semantic garbage.</em><small>Detecting it means predicting the future. Halting problem: undecidable.</small>', do: h => h.set('Bar', { cls: 'hot', sub: 'still useful?' }) },
      { t: 'A tracing GC asks exactly one question: <b>is it reachable?</b> Foo is freed, Bar survives.<small>Bonus: in optimized code the JIT knows <code>x</code> is dead after its last use, so Bar can go even while <code>x</code> is “in scope”. That is why <code>GC.KeepAlive</code> and <code>Reference.reachabilityFence</code> exist.</small>', do: h => { h.del('Foo'); h.set('Bar', { cls: 'live', sub: 'reachable' }); } },
    ],
  });

  scene('use-after-free', {
    lang: 'c', codeTitle: 'C',
    code: 'char *p = malloc(4);\nstrcpy(p, "moreThan3");\nfree(p);\nchar *q = malloc(4);\nstrcpy(q, "root");\nputs(p);',
    legend: [['live', 'in use'], ['free', 'free'], ['garbage', 'corrupted'], ['hot', 'reused']],
    init: h => {
      h.region('mem', { x: 40, y: 200, w: 920, h: 240, label: 'heap', sub: '1 byte = 40 px' });
      h.add('F1', { x: 60, y: 300, w: 280, h: 80, label: 'free', cls: 'free' });
      h.add('Nh', { x: 340, y: 300, w: 40, h: 80, label: 'hdr', cls: 'hdr' });
      h.add('N', { x: 380, y: 300, w: 240, h: 80, label: 'isAdmin = 0', sub: "someone else's data", cls: 'live mono' });
      h.add('F2', { x: 620, y: 300, w: 320, h: 80, label: 'free', cls: 'free' });
    },
    steps: [
      { t: 'C: you ask for memory, you give it back. <b>Manually.</b> The allocator keeps a list of free blocks.' },
      { hl: [1], t: '<code>malloc(4)</code> walks the free list, splits a block, writes a header, returns a pointer.', do: h => {
        h.set('F1', { w: 80 });
        h.add('Ah', { x: 140, y: 300, w: 40, h: 80, label: 'hdr', cls: 'hdr' });
        h.add('A', { x: 180, y: 300, w: 160, h: 80, label: '4 bytes', cls: 'live mono' });
        h.ptr('p', { x: 230, y: 296, label: 'p' });
      } },
      { hl: [2], t: '<code>"moreThan3"</code> + <code>\\0</code> = <b>10 bytes</b> into a 4-byte block. The neighbour’s header and data are overwritten: <em>buffer overflow</em>.', do: h => {
        h.set('A', { label: 'more' });
        h.add('OV', { x: 340, y: 300, w: 240, h: 80, label: 'Than3\\0', cls: 'overflow' });
        h.set('N', { label: 'isAdmin = 3', cls: 'garbage mono', sub: 'corrupted' });
        h.set('Nh', { cls: 'garbage hdr' });
      } },
      { hl: [3], t: '<code>free(p)</code> hands the block back. <code>p</code> still holds the address: a <em>dangling pointer</em>.', do: h => {
        h.del('OV');
        h.set('A', { label: 'free', cls: 'free' });
        h.set('p', { label: 'p (dangling)', cls: 'danger' });
      } },
      { hl: [4], t: 'Next <code>malloc(4)</code>: first fit — the very same block.', do: h => {
        h.set('A', { label: '', cls: 'hot mono' });
        h.ptr('q', { x: 300, y: 296, label: 'q', cls: 'blue' });
        h.set('p', { x: 200 });
      } },
      { hl: [5, 6], t: '<code>puts(p)</code> prints <b>"root"</b>: p reads q’s data. <em>Use-after-free.</em><small>~70% of security fixes at Microsoft and in Chrome are memory-safety bugs. About half of Chrome’s are use-after-free.</small>', do: h => {
        h.set('A', { label: '"root"' });
        h.text('out', { x: 60, y: 520, label: '$ ./a.out  →  root', size: 26, cls: 'mono danger' });
      } },
    ],
  });

  scene('escape', {
    lang: 'java', codeTitle: 'Java',
    code: 'double dist(int x, int y) {\n  var p = new Point(x, y);\n  return p.length();\n}\n\nPoint make(int x, int y) {\n  return new Point(x, y);\n}',
    legend: [['root', 'stack slot'], ['live', 'heap object'], ['hot', 'escapes']],
    init: h => {
      h.region('stack', { x: 40, y: 60, w: 400, h: 520, label: 'Stack', cls: 'stack' });
      h.region('heap', { x: 480, y: 60, w: 480, h: 520, label: 'Heap' });
      h.region('main', { x: 60, y: 400, w: 360, h: 160, label: 'caller()' });
      h.region('f1', { x: 60, y: 110, w: 360, h: 220, label: 'dist()' });
      h.add('p', { x: 80, y: 160, w: 150, h: 54, label: 'p', cls: 'stack-var' });
    },
    steps: [
      { t: 'Every <code>new</code> is future GC work. The cheapest object is one that is never allocated.' },
      { hl: [2], t: 'Naively: <code>new Point</code> goes to the heap, <code>p</code> points to it.', do: h => { h.add('Point', { x: 620, y: 150, w: 200, h: 84, sub: 'x, y', cls: 'live' }); h.ref('p', 'Point', { cls: 'live' }); } },
      { hl: [2, 3], t: 'The JIT proves <code>p</code> never leaves <code>dist()</code>: <b>escape analysis</b>. Result: <b>scalar replacement</b> — the fields become plain locals.<small>No allocation. No GC. No object header.</small>', do: h => {
        h.del('Point p');
        h.add('px', { x: 80, y: 160, w: 150, h: 54, label: 'p.x', cls: 'stack-var', spawn: 'Point' });
        h.add('py', { x: 250, y: 160, w: 150, h: 54, label: 'p.y', cls: 'stack-var', spawn: 'Point' });
      } },
      { hl: [4], t: 'Return: the frame is popped. The “object” is gone, for free.', do: h => h.del('px py f1') },
      { hl: [6, 7, 8], t: 'Returned, stored in a field, or passed to code the JIT can’t see → it <b>escapes</b> → heap.', do: h => {
        h.add('pt', { x: 80, y: 450, w: 150, h: 54, label: 'pt', cls: 'stack-var' });
        h.add('P2', { x: 620, y: 420, w: 200, h: 84, label: 'Point', sub: 'escaped', cls: 'hot' });
        h.ref('pt', 'P2', { cls: 'hot' });
      } },
      { t: '<b>Java</b>: C2 does this since JDK 6u23.<br><b>.NET</b>: object stack allocation arrived in .NET 9 and got much broader in .NET 10.<small>C# can also do it by hand: <code>struct</code>, <code>stackalloc</code>, <code>Span&lt;T&gt;</code>. Java waits for Valhalla value classes.</small>' },
    ],
  });

  scene('refcount', {
    lang: 'cs', codeTitle: 'pseudo code',
    code: 'var a = new A();\na.child = new B();\nvar b = a.child;\na = null;\nb.next = new C();\nb.next.next = b;\nb = null;',
    legend: [['root', 'variable'], ['live', 'object (badge = count)'], ['garbage', 'count = 0'], ['leak', 'leaked']],
    init: h => {
      h.region('stack', { x: 40, y: 60, w: 220, h: 520, label: 'Stack', cls: 'stack' });
      h.region('heap', { x: 300, y: 60, w: 660, h: 520, label: 'Heap' });
      h.add('a', { x: 80, y: 150, w: 140, h: 56, cls: 'stack-var' });
      h.add('b', { x: 80, y: 360, w: 140, h: 56, cls: 'stack-var' });
    },
    steps: [
      { t: 'Reference counting: every object carries a counter — how many references point at it.' },
      { hl: [1], t: 'One reference → count 1.', do: h => { h.add('A', { x: 380, y: 140, w: 120, h: 76, badge: 1, cls: 'live' }); h.ref('a', 'A'); } },
      { hl: [2], t: 'A references B → B’s count is 1.', do: h => { h.add('B', { x: 600, y: 260, w: 120, h: 76, badge: 1, cls: 'live' }); h.ref('A', 'B'); } },
      { hl: [3], t: 'Copy a reference → increment. Shared across threads? An <b>atomic</b> increment, on every pointer copy.', do: h => { h.ref('b', 'B'); h.set('B', { badge: 2 }); } },
      { hl: [4], t: 'Count hits 0 → freed <b>immediately</b>. Deterministic, no tracing, no big pauses…', do: h => { h.unref('a'); h.set('A', { badge: 0, cls: 'garbage' }); } },
      { t: '…and freeing A decrements B. Frees can cascade through a whole tree — that is a pause too.', do: h => { h.del('A'); h.set('B', { badge: 1 }); } },
      { hl: [5], t: 'B → C.', do: h => { h.add('C', { x: 800, y: 440, w: 120, h: 76, badge: 1, cls: 'live' }); h.ref('B', 'C', { c: [60, -30] }); } },
      { hl: [6], t: 'C → B: a <b>cycle</b>.', do: h => { h.ref('C', 'B', { c: [-60, 40] }); h.set('B', { badge: 2 }); } },
      { hl: [7], t: 'Drop the last outside reference. B and C are unreachable — but both counts are still 1. <em>Leaked forever.</em>', do: h => { h.unref('b'); h.set('B', { badge: 1, cls: 'leak', sub: 'unreachable' }); h.set('C', { cls: 'leak', sub: 'unreachable' }); } },
      { t: 'Fixes: break cycles by hand with weak refs (Swift <code>weak</code>, Rust <code>Weak</code>), or add a backup tracing collector (Python, PHP).<small>Neither the JVM nor the CLR refcounts objects. Both <b>trace</b>.</small>' },
    ],
  });

  const HEAP = [['A', 80], ['B', 60], ['C', 100], ['D', 60], ['E', 80], ['F', 120], ['G', 60], ['H', 100], ['I', 80], ['J', 60], ['K', 120]];
  const LIVE = ['A', 'C', 'E', 'H', 'I', 'K'];
  const DEAD = ['B', 'D', 'F', 'G', 'J'];
  function buildHeap(h) {
    h.region('roots', { x: 30, y: 40, w: 940, h: 120, label: 'roots' });
    h.region('heap', { x: 30, y: 300, w: 940, h: 140, label: 'heap' });
    h.add('R1', { x: 90, y: 85, w: 150, h: 54, label: 'order', sub: 'stack', cls: 'root' });
    h.add('R2', { x: 420, y: 85, w: 150, h: 54, label: 'Cache', sub: 'static', cls: 'root' });
    h.add('R3', { x: 760, y: 85, w: 150, h: 54, label: 'rax', sub: 'register', cls: 'root' });
    let x = 40;
    for (const [id, w] of HEAP) { h.add(id, { x, y: 350, w, h: 74, sub: `${w} B` }); x += w; }
    h.ref('R1', 'A'); h.ref('R2', 'C'); h.ref('R3', 'H');
    h.ref('A', 'E', { c: [0, 120] }); h.ref('C', 'K', { c: [0, 190] }); h.ref('K', 'I', { c: [0, 80] });
    h.ref('B', 'D', { c: [0, 90] }); h.ref('F', 'G', { c: [0, 60] }); h.ref('G', 'F', { c: [0, 100] }); h.ref('J', 'I', { c: [0, 60] });
  }

  scene('mark-sweep', {
    legend: [['root', 'root'], ['live', 'marked'], ['garbage', 'garbage'], ['free', 'free']],
    init: buildHeap,
    steps: [
      { t: '<b>Roots</b>: what the program touches directly — stack slots, statics, CPU registers. Everything else is only reachable <i>through</i> them.' },
      { t: 'An allocation fails: heap full. <b>Stop the world</b>: every app thread parks at a safepoint.', do: h => h.text('stw', { x: 500, y: 225, label: 'STOP THE WORLD', anchor: 'middle', size: 34, cls: 'danger banner' }) },
      { t: '<b>Mark</b>: depth-first from every root. Set the mark bit, follow the references.', do: h => { h.cls('A', 'live'); h.edge('R1', 'A', { cls: 'live' }); } },
      { t: 'A → E. Every reachable object gets marked exactly once.', do: h => { h.cls('E H', 'live'); h.edge('A', 'E', { cls: 'live' }); h.edge('R3', 'H', { cls: 'live' }); } },
      { t: 'Same for the other roots: C → K → I.', do: h => { h.cls('C K I', 'live'); h.edge('R2', 'C', { cls: 'live' }); h.edge('C', 'K', { cls: 'live' }); h.edge('K', 'I', { cls: 'live' }); } },
      { t: 'Everything unmarked is garbage — including the <b>F ⇄ G cycle</b> that reference counting would leak. J → I doesn’t matter: direction counts.', do: h => h.cls(DEAD, 'garbage') },
      { t: '<b>Sweep</b>: walk the <i>entire</i> heap, add dead blocks to a free list. Cost ∝ heap size, not live data.', do: h => {
        h.del('B D J G');
        h.set('F', { w: 180, label: '', sub: '180 B', cls: 'free' });
        h.add('B_', { x: 120, y: 350, w: 60, h: 74, label: '', sub: '60 B', cls: 'free' });
        h.add('D_', { x: 280, y: 350, w: 60, h: 74, label: '', sub: '60 B', cls: 'free' });
        h.add('J_', { x: 780, y: 350, w: 60, h: 74, label: '', sub: '60 B', cls: 'free' });
      } },
      { t: 'Resume. Now <code>new byte[200]</code>: <b>360 B free</b>, biggest hole <b>180 B</b>. <em>Fragmentation</em> → grow the heap or OOM.', do: h => {
        h.del('stw');
        h.cls(LIVE, '');
        h.edges.forEach(e => (e.cls = ''));
        h.add('X', { x: 410, y: 200, w: 200, h: 74, label: 'new 200 B', cls: 'hot' });
        h.text('sum', { x: 500, y: 580, label: 'free: 60 + 60 + 180 + 60 = 360 B   ·   largest block: 180 B', anchor: 'middle', size: 22, cls: 'mono muted' });
      } },
      { t: 'Non-moving collectors live with this: CMS (removed), .NET’s Large Object Heap, Go.<small>The fix: <b>move</b> objects together.</small>' },
    ],
  });

  scene('mark-compact', {
    legend: [['root', 'root'], ['live', 'live'], ['garbage', 'garbage'], ['free', 'free']],
    init: h => { buildHeap(h); h.cls(LIVE, 'live'); h.cls(DEAD, 'garbage'); },
    steps: [
      { t: 'Same heap, same marking. This time we <b>move</b> things.' },
      { t: 'Pass 1: compute each survivor’s new address — slide everything left, keep the order.', do: h => {
        let x = 0;
        for (const [id, w] of HEAP) if (LIVE.includes(id)) { h.set(id, { sub: `→ ${x}` }); x += w; }
      } },
      { t: 'Pass 2: rewrite <b>every pointer</b> — in roots and in objects — to the new address.', do: h => h.edges.forEach(e => { if (!DEAD.includes(e.a)) e.cls = 'hot'; }) },
      { t: 'Pass 3: move. Garbage is simply overwritten.', do: h => {
        h.del(DEAD);
        let x = 40;
        for (const [id, w] of HEAP) if (LIVE.includes(id)) { h.set(id, { x, sub: `${w} B` }); x += w; }
        h.edges.forEach(e => (e.cls = ''));
        h.edge('C', 'K', { c: [0, 120] }); h.edge('K', 'I', { c: null }); h.edge('A', 'E', { c: [0, 90] });
      } },
      { t: 'All free space is one block. Allocation = <b>bump a pointer</b>: one compare, one add.', do: h => {
        h.add('free', { x: 600, y: 350, w: 360, h: 74, label: '', sub: '360 B', cls: 'free' });
        h.ptr('alloc', { x: 600, y: 344, label: 'alloc ptr' });
      } },
      { t: '<code>new byte[200]</code> just fits.', do: h => {
        h.add('X', { x: 600, y: 350, w: 200, h: 74, label: 'X', sub: '200 B', cls: 'hot' });
        h.set('free', { x: 800, w: 160, sub: '160 B' });
        h.set('alloc', { x: 800 });
      } },
      { t: 'Price: copying + fixing every pointer. And you can’t move what native code points at → <b>pinning</b>.<small>C#: <code>fixed</code>, <code>GCHandle.Alloc(…, Pinned)</code>, the Pinned Object Heap.</small>' },
    ],
  });

  scene('copying', {
    legend: [['root', 'root'], ['live', 'copied'], ['garbage', 'garbage'], ['free', 'forwarding address']],
    init: h => {
      h.region('from', { x: 200, y: 60, w: 760, h: 180, label: 'from-space' });
      h.region('to', { x: 200, y: 340, w: 760, h: 190, label: 'to-space' });
      h.region('roots', { x: 30, y: 60, w: 140, h: 470, label: 'roots' });
      h.add('R1', { x: 45, y: 140, w: 110, h: 54, label: 'r1', cls: 'root' });
      h.add('R2', { x: 45, y: 440, w: 110, h: 54, label: 'r2', cls: 'root' });
      const objs = [['A', 220, 90], ['B', 320, 80], ['C', 410, 100], ['D', 520, 80], ['E', 610, 90], ['F', 710, 110], ['G', 830, 100]];
      for (const [id, x, w] of objs) h.add(id, { x, y: 130, w, h: 70 });
      h.ref('R1', 'A'); h.ref('R2', 'E');
      h.ref('A', 'C', { c: [0, -70] }); h.ref('C', 'A', { c: [0, -100] }); h.ref('C', 'E', { c: [0, 90] }); h.ref('E', 'F');
      h.ref('B', 'D', { c: [0, 90] }); h.ref('G', 'E', { c: [0, -80] });
    },
    steps: [
      { t: 'Split the heap in two. The app only allocates in <b>from-space</b>.' },
      { t: 'Copy what the roots point to. Leave a <b>forwarding address</b> in the old copy.', do: h => { copy(h, 'A', 220); h.unref('R1'); h.ref('R1', 'A2', { cls: 'live' }); scan(h, 220, 310); } },
      { t: 'Root r2 → E: copy E too.', do: h => { copy(h, 'E', 320); h.unref('R2'); h.ref('R2', 'E2', { cls: 'live' }); scan(h, 220, 410); } },
      { t: 'Scan the copies left to right (Cheney). A′ still points to the old C → copy C, update A′.', do: h => { copy(h, 'C', 420); h.unref('A2', 'C'); h.ref('A2', 'C2', { cls: 'live', c: [0, -100] }); scan(h, 320, 520); } },
      { t: 'E′ → F: copy F.', do: h => { copy(h, 'F', 530); h.unref('E2', 'F'); h.ref('E2', 'F2', { cls: 'live', c: [0, 80] }); scan(h, 420, 640); } },
      { t: 'C′ points to A and E — both already forwarded. Just follow the forwarding address.', do: h => { h.unref('C2'); h.ref('C2', 'A2', { cls: 'live', c: [0, 90] }); h.ref('C2', 'E2', { cls: 'live' }); scan(h, 640, 640); } },
      { t: 'scan == free: done. B, D and G were <b>never even looked at</b>. Cost ∝ live data, not heap size.', do: h => h.cls('B D G', 'garbage') },
      { t: 'Wipe from-space in one go. Swap roles.', do: h => { h.del('A B C D E F G scan'); h.set('from', { label: 'to-space (empty)' }); h.set('to', { label: 'from-space' }); h.set('free', { label: 'alloc ptr' }); } },
      { t: 'Price: half the memory sits empty. Great when almost everything dies: that’s why the JVM uses it for the <b>young generation</b>.' },
    ],
  });
  function copy(h, id, x) {
    const o = h.get(id);
    const n = id + '2';
    h.add(n, { x, y: 420, w: o.w, h: o.h, label: id + '′', cls: 'live', spawn: id });
    for (const e of h.edgesFrom(id)) h.ref(n, e.b, { cls: 'muted' });
    h.unref(id);
    h.set(id, { cls: 'fwd', label: '→' + id + '′' });
    h.ref(id, n, { cls: 'muted' });
  }
  function scan(h, s, f) {
    if (!h.has('scan')) { h.ptr('scan', { x: s, y: 414, label: 'scan', cls: 'blue' }); h.ptr('free', { x: f, y: 414, label: 'free' }); }
    h.set('scan', { x: s }); h.set('free', { x: f });
  }

  scene('tricolor', {
    lang: 'cs', codeTitle: 'meanwhile, in the app',
    code: '// GC: marking…\na.f = b.f;\nb.f = null;\n// GC: …marking resumes',
    legend: [['white', 'white: not seen'], ['gray', 'gray: to scan'], ['black', 'black: done'], ['garbage', 'freed']],
    init: h => {
      h.add('R', { x: 40, y: 290, w: 90, h: 56, label: 'root', cls: 'root' });
      for (const [id, x, y] of [['A', 250, 150], ['B', 250, 430], ['E', 520, 70], ['C', 520, 430], ['D', 780, 430], ['G', 780, 230]]) h.add(id, { x, y, w: 84, h: 60, cls: 'white' });
      h.ref('R', 'A'); h.ref('R', 'B'); h.ref('A', 'E'); h.ref('B', 'C'); h.ref('C', 'D'); h.ref('G', 'C');
    },
    steps: [
      { t: '<b>Tri-color</b> marking. <b>White</b>: not reached (yet). <b>Gray</b>: reached, fields not scanned. <b>Black</b>: done.' },
      { t: 'Start: shade everything the roots reference gray.', do: h => h.cls('A B', 'gray') },
      { t: 'Take a gray object, shade its children gray, turn it black.', do: h => { h.cls('A', 'black'); h.cls('E', 'gray'); } },
      { t: 'E has no references → black.', do: h => h.cls('E', 'black') },
      { t: 'Marking is <b>incremental / concurrent</b>: the GC yields and <b>the app keeps running</b>.', do: h => h.text('app', { x: 500, y: 600, label: 'APP RUNNING', anchor: 'middle', size: 30, cls: 'warn banner' }) },
      { hl: [2], t: 'App: <code>a.f = b.f</code> — A now also references C.', do: h => h.ref('A', 'C', { cls: 'hot' }) },
      { hl: [3], t: 'App: <code>b.f = null</code> — C is now only reachable from <b>black</b> A. The GC will never look at A again.', do: h => h.unref('B', 'C') },
      { hl: [4], t: 'GC resumes: scan B → no references → black. No gray left: marking done.', do: h => { h.del('app'); h.cls('B', 'black'); } },
      { t: 'Sweep everything white: C, D, G. But A still points to C. <em>💥 Use-after-free — in a “safe” runtime.</em>', do: h => { h.cls('C D G', 'garbage'); h.edge('A', 'C', { cls: 'dead' }); } },
      { hl: [2], t: 'Invariant broken: <b>black → white</b>. Rewind. The fix is a <b>write barrier</b>: a few instructions the JIT emits on every reference store.', do: h => {
        h.cls('C D G', 'white'); h.cls('B', 'gray'); h.ref('B', 'C');
        h.edge('A', 'C', { cls: 'barrier', label: 'barrier: shade(C)', lx: -60, ly: -6 });
        h.cls('C', 'gray');
      } },
      { hl: [3, 4], t: 'Now marking finds everything: C black, D gray → black.', do: h => { h.unref('B', 'C'); h.cls('B C D', 'black'); h.edge('A', 'C', { cls: '', label: '' }); } },
      { t: 'Only true garbage stays white. G is freed. ✔<small>Dijkstra barrier: shade the new target. G1 & Shenandoah use SATB: shade the <i>overwritten</i> value. ZGC: load barriers. .NET background GC: write watch + card marking.</small>', do: h => h.del('G') },
    ],
  });

  const EDEN = (i, row) => ({ x: 60 + (i % 8) * 62, y: 100 + row * 50 });
  scene('java-gen', {
    lang: 'java',
    legend: [['live', 'live'], ['garbage', 'garbage'], ['old', 'tenured'], ['hot', 'old → young']],
    init: h => {
      h.region('eden', { x: 40, y: 60, w: 520, h: 250, label: 'Eden', cls: 'eden' });
      h.region('s0', { x: 580, y: 60, w: 180, h: 250, label: 'S0', cls: 'surv' });
      h.region('s1', { x: 780, y: 60, w: 180, h: 250, label: 'S1', cls: 'surv' });
      h.region('old', { x: 40, y: 340, w: 920, h: 200, label: 'Old gen', cls: 'oldgen' });
    },
    steps: [
      { t: '<b>Young</b> = Eden + two Survivor spaces. <b>Old</b> = tenured. Same idea in Serial, Parallel, G1 (as regions).' },
      { t: '<code>new</code>: bump a pointer in the thread’s own buffer (TLAB) inside Eden. No locks, ~10 instructions.', do: h => {
        for (let i = 0; i < 16; i++) h.add('e' + i, { ...EDEN(i, i >> 3), w: 54, h: 40, label: '' });
        h.ptr('tlab', { x: 60 + 8 * 62 - 4, y: 146, label: 'TLAB' });
      } },
      { t: 'Eden full → <b>minor GC</b>. Stop-the-world, but only the young gen is marked.', do: h => {
        h.del('tlab');
        for (let i = 0; i < 16; i++) h.cls('e' + i, [3, 7, 12].includes(i) ? 'live' : 'garbage');
      } },
      { t: 'Copy survivors to <b>S0</b>, age 1. Eden is wiped in one go — dead objects cost <b>nothing</b>.', do: h => {
        for (let i = 0; i < 16; i++) if (![3, 7, 12].includes(i)) h.del('e' + i);
        [3, 7, 12].forEach((i, k) => h.set('e' + i, { x: 600 + (k % 2) * 70, y: 110 + (k >> 1) * 55, badge: 1 }));
      } },
      { t: 'The app fills Eden again.', do: h => { for (let i = 0; i < 16; i++) h.add('f' + i, { ...EDEN(i, i >> 3), w: 54, h: 40, label: '' }); } },
      { t: 'Minor GC #2: survivors from Eden <b>and</b> S0 move to <b>S1</b>, age + 1. Then S0 and S1 swap roles.', do: h => {
        h.del('e7');
        for (let i = 0; i < 16; i++) if (![2, 9].includes(i)) h.del('f' + i);
        const s1 = ['e3', 'e12', 'f2', 'f9'];
        s1.forEach((id, k) => h.set(id, { x: 800 + (k % 2) * 70, y: 110 + (k >> 1) * 55, badge: id[0] === 'e' ? 2 : 1, cls: 'live' }));
      } },
      { t: 'A few minor GCs later: age ≥ tenuring threshold (≤ 15, adaptive) → <b>promoted</b> to Old.', do: h => {
        h.set('e3', { x: 70, y: 400, badge: '', cls: 'old' });
        h.set('e12', { x: 140, y: 400, badge: '', cls: 'old' });
        h.set('f2 f9', { badge: 3 });
      } },
      { t: 'Problem: an old object references a young one. A minor GC can’t afford to scan all of Old to find that.', do: h => {
        for (let i = 0; i < 6; i++) h.add('o' + i, { x: 210 + i * 70, y: 400, w: 54, h: 40, label: '', cls: 'old' });
        h.add('g1', { x: 300, y: 150, w: 54, h: 40, label: '', cls: 'live' });
        h.ref('o3', 'g1', { cls: 'hot' });
      } },
      { t: '<b>Card table</b>: the write barrier marks the 512-byte card dirty. A minor GC scans only dirty cards as extra roots.', do: h => {
        for (let i = 0; i < 18; i++) h.add('card' + i, { x: 60 + i * 50, y: 490, w: 42, h: 26, label: '', cls: i === 7 ? 'garbage' : 'free' });
        h.text('cardl', { x: 60, y: 582, label: 'card table — 1 byte per 512 B of old gen', size: 18, cls: 'mono muted' });
      } },
      { t: 'Old gen full → <b>major / full GC</b>: mark-compact everything. That’s the long pause the modern collectors fight.', do: h => h.cls('old', 'oldgen active') },
    ],
  });

  const G0 = i => ({ x: 60 + (i % 4) * 62, y: 105 + (i >> 2) * 50 });
  scene('dotnet-gen', {
    lang: 'cs', codeTitle: 'C#',
    code: 'var order = new Order();\nGC.GetGeneration(order);  // 0, 1 or 2\n\nvar big = new byte[100_000];\nvar buf = GC.AllocateArray<byte>(\n    4096, pinned: true);',
    legend: [['live', 'live'], ['garbage', 'garbage'], ['old', 'gen2'], ['big-obj', 'large'], ['pinned', 'pinned']],
    init: h => {
      h.region('g0', { x: 40, y: 60, w: 280, h: 260, label: 'gen0', cls: 'eden' });
      h.region('g1', { x: 340, y: 60, w: 280, h: 260, label: 'gen1', cls: 'surv' });
      h.region('g2', { x: 640, y: 60, w: 320, h: 260, label: 'gen2', cls: 'oldgen' });
      h.region('loh', { x: 40, y: 350, w: 580, h: 200, label: 'LOH', sub: '≥ 85,000 bytes', cls: 'loh' });
      h.region('poh', { x: 640, y: 350, w: 320, h: 200, label: 'POH', sub: 'pinned', cls: 'poh' });
    },
    steps: [
      { t: 'Small Object Heap: <b>gen0, gen1, gen2</b>. Plus the <b>Large</b> and <b>Pinned</b> Object Heaps.<small>Since .NET 7 each generation is a set of <b>regions</b> instead of one big segment.</small>' },
      { hl: [1], t: 'Allocate in gen0 through a per-thread <b>allocation context</b>: bump pointer.', do: h => {
        for (let i = 0; i < 16; i++) h.add('a' + i, { ...G0(i), w: 54, h: 40, label: '' });
      } },
      { t: 'gen0 budget used up → <b>gen0 GC</b> (the cheap, frequent one). Mark…', do: h => { for (let i = 0; i < 16; i++) h.cls('a' + i, [2, 6, 11].includes(i) ? 'live' : 'garbage'); } },
      { hl: [2], t: '…compact, and <b>promote</b> survivors to gen1.', do: h => {
        for (let i = 0; i < 16; i++) if (![2, 6, 11].includes(i)) h.del('a' + i);
        [2, 6, 11].forEach((i, k) => h.set('a' + i, { x: 360 + k * 62, y: 105, badge: 1 }));
      } },
      { t: 'More allocations, more gen0 GCs… then a <b>gen1 GC</b>: collects gen0 + gen1. gen1 survivors go to gen2.<small>gen1 is the buffer between short-lived and long-lived.</small>', do: h => {
        h.del('a6');
        h.set('a2', { x: 660, y: 105, badge: 2, cls: 'old' });
        h.set('a11', { x: 722, y: 105, badge: 2, cls: 'old' });
        h.add('b3', { x: 360, y: 105, w: 54, h: 40, label: '', badge: 1, cls: 'live', spawn: 'g0' });
        h.add('b7', { x: 422, y: 105, w: 54, h: 40, label: '', badge: 1, cls: 'live', spawn: 'g0' });
      } },
      { hl: [4], t: '<code>new byte[100_000]</code> skips all that: straight into the <b>LOH</b>, logically gen2. Collected only with gen2. Swept, not compacted (by default).', do: h => {
        h.add('L1', { x: 70, y: 410, w: 230, h: 80, label: 'byte[100_000]', cls: 'big-obj mono' });
        h.add('L2', { x: 320, y: 410, w: 270, h: 80, label: 'byte[120_000]', cls: 'big-obj mono' });
      } },
      { hl: [5, 6], t: 'Pinned I/O buffers go to the <b>POH</b> (.NET 5+), so they never block compaction of the small heap.', do: h => { h.add('P1', { x: 670, y: 410, w: 120, h: 80, label: 'buf', sub: '4 KB', cls: 'pinned' }); } },
      { t: '<b>gen2 GC</b> = full GC, LOH included. Usually a <b>background GC</b>: gen2 is marked concurrently while gen0/gen1 GCs keep running.', do: h => { h.cls('g2', 'oldgen active'); h.cls('loh', 'loh active'); h.cls('L2', 'garbage mono'); } },
      { t: 'LOH is swept: a free hole stays where L2 was. Fragmentation, unless you opt in to <code>GCSettings.LargeObjectHeapCompactionMode</code>.', do: h => { h.cls('g2', 'oldgen'); h.cls('loh', 'loh'); h.set('L2', { cls: 'free', label: 'free' }); } },
    ],
  });

  const X = t => 150 + t * 8;
  const ROW_APP = [120, 170, 220], ROW_GC = [330, 380, 430];
  const COLLECTORS = {
    none: { name: 'no GC', lang: '', stw: [], conc: [] },
    serial: { name: 'Serial', lang: 'java', gc: 1, stw: [[15, 22, 'young'], [55, 82, 'full GC']], conc: [] },
    parallel: { name: 'Parallel', lang: 'java', gc: 3, stw: [[15, 17.5, ''], [55, 64, 'full']], conc: [] },
    cms: { name: 'CMS', lang: 'java', gc: 3, stw: [[10, 12, ''], [30, 31.5, ''], [55, 57.5, ''], [86, 88, '']], conc: [[31.5, 55, 0, 'concurrent mark'], [57.5, 78, 0, 'concurrent sweep']] },
    g1: { name: 'G1', lang: 'java', gc: 3, stw: [[10, 12, ''], [35, 37, ''], [60, 61.5, ''], [82, 85, 'mixed']], conc: [[37, 60, 0, 'concurrent mark (SATB)']] },
    zgc: { name: 'ZGC', lang: 'java', gc: 1, stw: [[20, 20.3, ''], [45, 45.3, ''], [70, 70.3, '']], conc: [[20.3, 45, 0, 'mark'], [45.3, 70, 0, 'relocate'], [20.3, 45, 1, 'mark'], [45.3, 70, 1, 'relocate']] },
    ws: { name: 'Workstation', lang: 'dotnet', gc: 1, stw: [[15, 20, 'gen0'], [55, 74, 'gen2']], conc: [] },
    server: { name: 'Server', lang: 'dotnet', gc: 3, stw: [[15, 16.5, ''], [55, 61, 'gen2']], conc: [] },
    bg: { name: 'Background', lang: 'dotnet', gc: 1, stw: [[10, 12, ''], [30, 31, ''], [46, 48, ''], [64, 65.5, ''], [86, 88, '']], conc: [[31, 64, 0, 'background gen2 mark'], [65.5, 80, 0, 'bg sweep']] },
  };
  function timeline(h, key) {
    const c = COLLECTORS[key];
    Object.values(h.items).filter(it => it.kind === 'bar').forEach(it => h.del(it.id));
    const stw = c.stw;
    ROW_APP.forEach((y, r) => {
      let t = 0, k = 0;
      for (const [s, e] of [...stw, [100, 100]]) {
        if (s > t) h.add(`a${r}_${k++}`, { kind: 'bar', x: X(t), y, w: (s - t) * 8 - 2, h: 34, label: '', cls: 'app' });
        t = e;
      }
    });
    stw.forEach(([s, e, l], k) => {
      for (let r = 0; r < c.gc; r++) h.add(`s${r}_${k}`, { kind: 'bar', x: X(s), y: ROW_GC[r], w: Math.max(3, (e - s) * 8), h: 34, label: r === 0 ? l : '', cls: 'stw' });
      h.add(`p${k}`, { kind: 'bar', x: X(s), y: 108, w: Math.max(3, (e - s) * 8), h: 358, label: '', cls: 'stw', o: 0.18 });
    });
    c.conc.forEach(([s, e, r, l], k) => h.add(`c${k}`, { kind: 'bar', x: X(s), y: ROW_GC[r], w: (e - s) * 8 - 2, h: 34, label: l, cls: 'conc' }));
    h.set('name', { label: c.name, cls: `banner ${c.lang}` });
  }
  scene('timeline', {
    legend: [['app', 'app thread running'], ['stw', 'stop-the-world'], ['conc', 'concurrent GC work']],
    init: h => {
      h.text('name', { x: 40, y: 62, label: '', size: 36 });
      ['app 1', 'app 2', 'app 3'].forEach((l, i) => h.text('la' + i, { x: 40, y: ROW_APP[i] + 23, label: l, size: 16, cls: 'mono muted' }));
      ['GC 1', 'GC 2', 'GC 3'].forEach((l, i) => h.text('lg' + i, { x: 40, y: ROW_GC[i] + 23, label: l, size: 16, cls: 'mono muted' }));
      h.text('axis', { x: 950, y: 500, label: 'time →', anchor: 'end', size: 16, cls: 'mono muted' });
    },
    steps: [
      { t: 'Three app threads, three potential GC threads. <b>Green</b>: app runs. <b>Red</b>: stop-the-world. <b>Yellow</b>: GC works concurrently.', do: h => timeline(h, 'none') },
      { t: '<b>Serial</b> (Java). One GC thread, everybody waits. Still picked automatically on tiny containers (&lt; 2 CPUs or &lt; 1792 MB).', do: h => timeline(h, 'serial') },
      { t: '<b>Parallel</b> (Java). Same stop-the-world, all cores. Best throughput — pauses still grow with the heap.', do: h => timeline(h, 'parallel') },
      { t: '<b>CMS</b> (Java). Mark and sweep concurrently. Never compacts → fragmentation → nasty fallback full GC.<small>Deprecated in JDK 9, removed in JDK 14.</small>', do: h => timeline(h, 'cms') },
      { t: '<b>G1</b> (Java, default since 9). Short young pauses, concurrent marking, <b>mixed</b> pauses that compact a few old regions. Pause goal: 200 ms.', do: h => timeline(h, 'g1') },
      { t: '<b>ZGC</b> (Java). Marking <i>and moving</i> are concurrent. Pauses well under 1 ms, independent of heap size (up to 16 TB).<small>Paid with barriers and CPU. Shenandoah: same league.</small>', do: h => timeline(h, 'zgc') },
      { t: '<b>Workstation, non-concurrent</b> (.NET). GC runs on the thread that triggered it. Desktop apps of old.', do: h => timeline(h, 'ws') },
      { t: '<b>Server GC</b> (.NET). A heap and a GC thread per core: throughput, at a memory cost.<small>Since .NET 9, <b>DATAS</b> (on by default) adapts the number of heaps to the app.</small>', do: h => timeline(h, 'server') },
      { t: '<b>Background GC</b> (.NET default). gen2 is marked concurrently, and gen0/gen1 GCs still happen <i>during</i> it.', do: h => timeline(h, 'bg') },
    ],
  });

  const G1MAPS = [
    'OOEFFOSEFF FOEFOOFEFF OFFEOFFOFF FFOFFEFOFF FFOFFFFFFF',
    'OOEEFOSEEF FOEEOOFEFE OFEEOFFOFF FFOFEEFOFF FFOFFFFFFF',
    'OOFFFOFFFF SOFFOOFFFF OFFFOFFOFF FFOFFFFOFF FFOSFFFFOF',
    'OOFFFOFFFF SOFFOOFFFF OFFFOFFOFF FFOFFFFOFF FFOSFFFFOF',
    'OOFFFOFFFF SOFFOOFFFF OFFFOFFOFF FFOFFFFOFF FFOSFFFFOF',
    'FOFFFOFFFF SOFFFOFFFF OFFFOFFFFF FFOFOFFOFF FFOSFFFFOF',
    'FOFFFOFFFF SOFFFOFFFF OFFFOFFFFF FFOFOFFOFF HHHSFFFFOF',
  ];
  const LIVENESS = { 0: 92, 1: 8, 5: 71, 11: 85, 14: 12, 15: 95, 20: 80, 24: 15, 27: 88, 32: 74, 37: 61, 42: 90, 48: 66 };
  const CSET = [0, 14, 24, 37];
  function g1(h, i, opts = {}) {
    const map = G1MAPS[i].replace(/ /g, '');
    for (let k = 0; k < 50; k++) {
      const c = map[k];
      const id = 't' + k;
      const p = { x: 45 + (k % 10) * 92, y: 80 + Math.floor(k / 10) * 92, w: 82, h: 82, label: c === 'F' ? '' : c, sub: opts.live && c === 'O' && LIVENESS[k] !== undefined ? LIVENESS[k] + '% live' : '', cls: `tile ${c} ${opts.cset && CSET.includes(k) ? 'cset' : ''}` };
      h.has(id) ? h.set(id, p) : h.add(id, p);
    }
  }
  scene('g1', {
    lang: 'java',
    legend: [['E', 'Eden'], ['S', 'Survivor'], ['O', 'Old'], ['H', 'Humongous'], ['free', 'free'], ['hot', 'collection set']],
    init: h => g1(h, 0),
    steps: [
      { t: 'G1 cuts the heap into ~2048 equal <b>regions</b> (1–32 MB). Every region gets a role: Eden, Survivor, Old, Humongous — or free.' },
      { t: 'The app allocates: more Eden regions. Young gen size is adaptive, driven by the pause-time goal.', do: h => g1(h, 1) },
      { t: '<b>Young GC</b> (STW, parallel): evacuate live objects from all E + S regions into fresh S (or O when old enough). Emptied regions go back to the free list.', do: h => g1(h, 2) },
      { t: '<b>Concurrent marking</b> (SATB) computes how much live data each Old region holds.', do: h => g1(h, 3, { live: true }) },
      { t: '<b>Mixed GC</b>: young regions + the Old regions with the <b>most garbage first</b>. Hence the name.', do: h => g1(h, 4, { live: true, cset: true }) },
      { t: 'Their few live objects are compacted into a fresh region. Compaction happens <b>incrementally</b>, a few regions per pause.', do: h => g1(h, 5, { live: true }) },
      { t: 'Object ≥ ½ region → <b>humongous</b>: contiguous regions, allocated directly as old. Java’s answer to the LOH.', do: h => g1(h, 6) },
    ],
  });

  scene('zgc', {
    lang: 'java',
    legend: [['root', 'app thread'], ['live', 'live'], ['garbage', 'garbage'], ['free', 'old copy']],
    init: h => {
      h.add('T', { x: 360, y: 40, w: 280, h: 64, label: 'app thread', sub: 'p = 0x…A  [good color]', cls: 'root' });
      h.region('pg1', { x: 40, y: 200, w: 420, h: 200, label: 'page 1' });
      h.region('pg2', { x: 540, y: 200, w: 420, h: 200, label: 'page 2' });
      h.region('fwd', { x: 40, y: 450, w: 420, h: 150, label: 'forwarding table (page 1)', cls: 'queue' });
      h.add('A', { x: 70, y: 270, w: 110, h: 76 });
      h.add('X', { x: 195, y: 270, w: 110, h: 76 });
      h.add('B', { x: 320, y: 270, w: 110, h: 76 });
      h.ref('T', 'A');
      h.ref('A', 'B', { c: [0, 80] });
    },
    steps: [
      { t: '<b>ZGC</b>: concurrent marking <i>and</i> concurrent <b>relocation</b>. Every reference carries a few metadata bits: its <b>color</b>.' },
      { t: 'Concurrent mark: A and B live, X garbage. Page 1 is mostly garbage → it joins the <b>relocation set</b>.', do: h => { h.cls('A B', 'live'); h.cls('X', 'garbage'); h.cls('pg1', 'active'); } },
      { t: 'The GC copies A to page 2 <b>while the app runs</b> and records A → A′ in the forwarding table.', do: h => {
        h.add('A2', { x: 580, y: 270, w: 110, h: 76, label: 'A′', cls: 'live', spawn: 'A' });
        h.ref('A2', 'B', { c: [0, 120] });
        h.cls('A', 'fwd');
        h.text('f1', { x: 70, y: 520, label: 'A  →  A′  (page 2)', size: 22, cls: 'mono' });
      } },
      { t: 'The app still holds the <b>old</b> address of A. After the phase flip, its color bits say: <em>stale</em>.', do: h => { h.edge('T', 'A', { cls: 'dead' }); h.set('T', { sub: 'p = 0x…A  [bad color]', cls: 'root' }); } },
      { t: 'Next time the app loads <code>p</code>, the <b>load barrier</b> checks the color: bad → look up the forwarding table → <b>heal</b> the reference in place.', do: h => { h.unref('T', 'A'); h.ref('T', 'A2', { cls: 'hot' }); h.set('T', { sub: 'p = 0x…A′  [healed]' }); } },
      { t: 'Self-healing: the slow path runs at most once per reference. B moves on first touch — by a GC thread or the app, whoever gets there first.', do: h => {
        h.add('B2', { x: 710, y: 270, w: 110, h: 76, label: 'B′', cls: 'live', spawn: 'B' });
        h.cls('B', 'fwd');
        h.unref('A2', 'B'); h.ref('A2', 'B2');
        h.text('f2', { x: 70, y: 560, label: 'B  →  B′  (page 2)', size: 22, cls: 'mono' });
      } },
      { t: 'Page 1 holds no live objects → freed as a whole. No stop-the-world compaction. Ever.', do: h => { h.del('A X B'); h.set('pg1', { label: 'page 1 — free', cls: 'dim' }); } },
      { t: '<b>Generational ZGC</b>: default ZGC mode since JDK 23, the only one since JDK 24.<small>Shenandoah: same idea with load-reference barriers; generational mode is production-ready in JDK 25. .NET has no equivalent (yet).</small>' },
    ],
  });

  scene('refs', {
    lang: 'java', codeTitle: 'Java',
    code: 'var strong = new Widget();\nvar soft = new SoftReference<>(w2);\nvar weak = new WeakReference<>(w3);\nvar ph = new PhantomReference<>(w4, q);\n\nweak.get();   // may be null',
    legend: [['root', 'variable'], ['live', 'Widget'], ['free', 'Reference object']],
    init: h => {
      const rows = [['strong', 70], ['soft', 210], ['weak', 350], ['phantom', 490]];
      for (const [id, y] of rows) {
        h.add(id, { x: 40, y, w: 140, h: 56, cls: 'stack-var' });
        h.add('w_' + id, { x: 620, y, w: 140, h: 56, label: 'Widget', cls: 'live' });
        if (id !== 'strong') {
          h.add('r_' + id, { x: 280, y, w: 230, h: 56, label: id[0].toUpperCase() + id.slice(1) + 'Ref', cls: 'fwd' });
          h.ref(id, 'r_' + id);
          h.ref('r_' + id, 'w_' + id, { cls: 'weak' });
        } else h.ref(id, 'w_' + id, { cls: 'live' });
      }
      h.region('queue', { x: 800, y: 330, w: 170, h: 250, label: 'RefQueue', cls: 'queue' });
    },
    steps: [
      { hl: [1], t: 'A plain field is a <b>strong</b> reference: it keeps the object alive. Wrapper objects give you references the GC may ignore.' },
      { hl: [3, 6], t: 'GC, plenty of memory. <b>Weak</b>: referent collected, reference cleared. <code>get()</code> → <code>null</code>.', do: h => { h.del('w_weak'); h.set('r_weak', { sub: 'get() → null' }); } },
      { hl: [4], t: '<b>Phantom</b>: after the referent is collected, the reference itself is <b>enqueued</b>. <code>get()</code> always returns null — it’s a death notice.<small>That’s how <code>java.lang.ref.Cleaner</code> works: the replacement for <code>finalize()</code>.</small>', do: h => { h.del('w_phantom'); h.set('r_phantom', { x: 815, y: 380, w: 140, label: 'Phantom', cls: 'hot' }); } },
      { hl: [2], t: '<b>Soft</b>: survives. Cleared only under memory pressure, least recently used first.', do: h => h.cls('w_soft', 'live hot') },
      { hl: [2], t: 'Memory pressure: all soft references are cleared before the JVM throws <code>OutOfMemoryError</code>.', do: h => { h.del('w_soft'); h.set('r_soft', { sub: 'get() → null' }); } },
      { t: '<b>.NET</b>: <code>WeakReference&lt;T&gt;</code> = weak. <code>trackResurrection: true</code> = “long” weak ref that survives finalization. <b>No soft references</b> — use <code>MemoryCache</code>.<small><code>ConditionalWeakTable</code>: attach data to an object without keeping it alive.</small>' },
    ],
  });

  scene('finalize', {
    lang: 'cs', codeTitle: 'C#',
    code: 'class Conn : IDisposable {\n  ~Conn() => Dispose(false);\n\n  public void Dispose() {\n    Dispose(true);\n    GC.SuppressFinalize(this);\n  }\n}',
    legend: [['live', 'live'], ['garbage', 'garbage'], ['hot', 'resurrected']],
    init: h => {
      h.region('heap', { x: 40, y: 60, w: 560, h: 340, label: 'managed heap' });
      h.region('fq', { x: 640, y: 60, w: 320, h: 150, label: 'finalization queue', cls: 'queue' });
      h.region('fr', { x: 640, y: 250, w: 320, h: 150, label: 'f-reachable queue', cls: 'queue' });
      h.add('ft', { x: 640, y: 460, w: 320, h: 70, label: 'finalizer thread', sub: 'one per process', cls: 'root' });
      h.add('conn', { x: 60, y: 460, w: 160, h: 56, cls: 'stack-var' });
      h.add('A', { x: 90, y: 150, w: 150, h: 76, label: 'Conn', sub: '~Conn()', cls: 'live' });
      h.add('B', { x: 330, y: 150, w: 130, h: 76, label: 'Buffer', cls: 'live' });
      h.add('C', { x: 330, y: 290, w: 130, h: 76, label: 'Temp', cls: 'garbage' });
      h.add('q', { x: 670, y: 120, w: 140, h: 50, label: '→ Conn', cls: 'mono fwd' });
      h.ref('conn', 'A', { cls: 'live' }); h.ref('A', 'B'); h.ref('q', 'A', { cls: 'muted' });
    },
    steps: [
      { hl: [2], t: 'A type with a finalizer. At allocation time the GC registers the object in the <b>finalization queue</b>.' },
      { t: 'The last reference is dropped. Conn — and the Buffer it holds — are unreachable.', do: h => { h.unref('conn'); h.cls('A B', 'garbage'); } },
      { t: '<b>GC #1</b>: Temp is freed. Conn has a finalizer → moved to the <b>f-reachable queue</b>, which is a root: Conn and Buffer are <em>resurrected</em> and promoted to gen1.', do: h => {
        h.del('C');
        h.set('q', { x: 670, y: 310 });
        h.set('A', { cls: 'hot', sub: 'gen1' }); h.set('B', { cls: 'hot', sub: 'gen1' });
        h.edge('q', 'A', { cls: 'hot' });
      } },
      { t: 'The finalizer thread calls <code>~Conn()</code>… eventually. One thread, no ordering, and no guarantee it runs at all.', do: h => { h.cls('ft', 'root hot'); h.ref('ft', 'A', { cls: 'hot', c: [-40, 120] }); } },
      { t: 'Entry removed: now Conn is unreachable for real.', do: h => { h.del('q'); h.unref('ft'); h.cls('ft', 'root'); h.cls('A B', 'garbage'); } },
      { t: '<b>GC #2</b> — of gen1 this time — finally frees the memory. Two GCs, a thread hop and a promotion, for one object.', do: h => h.del('A B') },
      { hl: [4, 5, 6], t: '<code>Dispose()</code> + <code>GC.SuppressFinalize(this)</code> skips all of it. Wrapping a native handle? Use <code>SafeHandle</code>.<small>Java: <code>finalize()</code> is deprecated for removal (JEP 421). Use <code>Cleaner</code>.</small>' },
    ],
  });
})();
