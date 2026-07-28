# Azure Service Resiliency Factors

Factors that affect high availability, disaster recovery, and business continuity for Azure data services.

## Azure SQL Database

| Factor                     | Impact                      | Notes                                                                                                                                                           |
| -------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Service tier**           | Determines HA architecture  | General Purpose: local SSD/remote storage, 99.99% SLA. Business Critical: Always On AG replicas, 99.995% with zone redundancy. Hyperscale: distributed storage. |
| **Zone redundancy**        | Survives datacenter failure | Replicas spread across availability zones. Raises SLA from 99.99% → 99.995%. Available on Business Critical (default) and General Purpose.                      |
| **Failover groups**        | Cross-region DR             | Auto-failover to secondary region. RPO < 5s, RTO typically < 60s. Requires secondary server in paired region.                                                   |
| **Active geo-replication** | Read-scale + manual DR      | Up to 4 readable secondaries. Manual failover. No auto-failover like failover groups.                                                                           |
| **Backup retention**       | Point-in-time recovery      | 7–35 days default. Long-term retention (LTR) up to 10 years. Restore time proportional to DB size.                                                              |
| **Connection retry logic** | App-side resilience         | Transient fault handling. Use `SqlConnection` retry policies. Exponential backoff.                                                                              |
| **Maintenance window**     | Controls update timing      | Avoid conflicts with peak traffic. Default or custom window.                                                                                                    |

## Azure PostgreSQL Flexible Server

| Factor                     | Impact                      | Notes                                                                                                                 |
| -------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **High availability mode** | Same-zone or zone-redundant | Zone-redundant: standby in different AZ, sync replication. Same-zone: standby in same AZ. 99.99% SLA with HA enabled. |
| **Read replicas**          | Read offload + DR           | Up to 5 replicas. Cross-region supported. Async replication. Promotable for DR.                                       |
| **Geo-redundant backups**  | Regional outage protection  | Backups replicated to paired region. Must be enabled at creation (cannot add after).                                  |
| **Backup retention**       | Point-in-time recovery      | 7–35 days. Restore to any point within window.                                                                        |
| **Storage type**           | IO perf under load          | Premium SSD (managed) for prod. Auto-grow must be enabled to avoid storage-full outages.                              |
| **Connection pooling**     | Survives connection spikes  | Use PgBouncer. Built-in on Flexible Server. Without it, connection exhaustion kills resilience.                       |
| **Maintenance window**     | Avoids surprise restarts    | Planned maintenance during defined window. Critical for HA pairs.                                                     |

## Azure SQL Managed Instance

| Factor                     | Impact                   | Notes                                                                                                                   |
| -------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Service tier**           | Determines HA model      | General Purpose: 99.99% SLA, remote storage. Business Critical: 99.99% (+zone redun. → 99.995%), Always On AG replicas. |
| **Zone redundancy**        | AZ-level resilience      | Business Critical: default zone-redundant. General Purpose: zone redundancy supported since June 2025.                  |
| **Failover groups**        | Cross-region DR          | Auto-failover or customer-managed. RTO < 60s. RPO >= 0 (5s typical for manual failover policy).                         |
| **Instance subnet sizing** | Network-dependent        | Insufficient IP space blocks scaling or HA failover. Plan CIDR carefully.                                               |
| **Backup retention**       | Restore capability       | 1–35 days PITR. LTR up to 35 days (CI) or up to 10 years (SQL DB).                                                      |
| **Virtual network**        | Security + routing       | VNet-injected. DNS resolution, NSGs, UDRs must survive region events.                                                   |
| **Maintenance window**     | Planned downtime control | Same as Azure SQL.                                                                                                      |

## Azure Blob Storage + Azure Files

| Factor                               | Impact                         | Notes                                                                                                                                                                         |
| ------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Redundancy level**                 | Data durability                | **LRS**: 3 copies, single DC. **ZRS**: 3 AZs, sync. **GRS**: LRS + async to paired region. **GZRS**: ZRS + async to paired region. **RA-GRS/GZRS**: adds read-only secondary. |
| **Account kind**                     | Feature availability           | StorageV2 (general purpose v2) required for ZRS/GRS/GZRS. Premium block/blob accounts have different redundancy options.                                                      |
| **Azure Files tier**                 | Redundancy constraints         | Standard (HDD): supports GRS/GZRS. Premium (SSD): **ZRS only** — no geo-redundancy. Plan custom multi-region replication if you need cross-region Premium Files.              |
| **Soft delete**                      | Accidental deletion recovery   | Retains deleted blobs/shares 1–365 days. Must be enabled. Not on by default.                                                                                                  |
| **Versioning / snapshots**           | Point-in-time state            | Blob versioning stores every write. Snapshots: manual/automated snapshots for shares/blobs. Both costs storage.                                                               |
| **Change feed + object replication** | Cross-region copy              | Object replication copies blobs between accounts (same or different regions). Async. Useful for DR when geo-redundancy insufficient.                                          |
| **Point-in-time restore**            | Accidental corruption recovery | Restore block blobs to prior state. Requires soft delete, change feed, versioning. GPv2 only.                                                                                 |
| **Access tier**                      | Not a resiliency factor        | Hot/Cool/Archive affect cost and retrieval latency, not durability or availability.                                                                                           |
| **Private endpoints + NSG**          | Network resilience             | Paired with VNet for secure access. DNS config must survive failovers.                                                                                                        |

## Cross-Cutting Principles

1. **Zone redundancy > single zone** — Always enable for production. Cost increment is small relative to downtime.
2. **Failover groups > manual failover** — Auto-failover reduces RTO from minutes/hours to < 60s.
3. **Test failover regularly** — Untested DR isn't DR. Run drills quarterly.
4. **Connection retry + circuit breaker** — Apps must handle transient faults. Use Polly (C#), tenacity (Python), or equivalent.
5. **Geo-redundant backups at creation** — PostgreSQL Flexible Server requires this at creation time. Plan ahead.
6. **Monitor RPO/RTO drift** — Measure actual restore times. They drift as data grows.

## When to Escalate

- Multi-region active-active requires application-level conflict handling. Standard HA/DR tools won't cover it.
- RPO < 5s across regions needs synchronous commit (e.g., distributed transactions) — Azure SQL failover groups are async. Involve architect.
- Premium Files cross-region: no native geo-redundancy. Need custom replication solution (AzCopy, rsync, DFS-R).
