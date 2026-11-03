# Stop the World: A Cross-Runtime Tour of Modern Garbage Collection

## Abstract

Garbage collection is why most of us never call free(), and also why we sometimes stare at a stop-the-world pause in production. This session explains what a GC does (syntactic vs semantic garbage), why manual memory management is a security problem (70% of patched vulnerabilities are memory-safety bugs), and what GC costs. It walks through the strategies — escape analysis, reference counting, tracing, compacting vs non-moving, generations — then compares the .NET and JVM implementations side by side: Serial, Parallel, CMS, G1 and ZGC vs Workstation/Server and Background GC, plus weak, soft and phantom references and deterministic cleanup of I/O.

## Elevator pitch

.NET and the JVM answer the same question — when is memory garbage? — with very different bets. A side-by-side tour of GC strategies and implementations, and how to tell whether GC is actually your problem.

## Outline

- What: automatic memory management, syntactic vs semantic garbage, GC across languages
- Why: memory management is hard, memory-safety vulnerabilities
- Why not: memory overhead, CPU time, stop-the-world pauses
- Strategies: escape analysis, moving vs non-moving, reference counting, tracing (mark & sweep, tri-color)
- Generations; hybrid GC in .NET & Java
- Java implementations: Serial, Parallel, CMS, G1, ZGC
- .NET: Background GC, LOH, Workstation vs Server
- Strong/weak/soft/phantom references; non-determinism & I/O (try-with-resources vs using)
- Winner?
