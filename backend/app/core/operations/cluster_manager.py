"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 15.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Multi-Node High Availability & Cluster Manager
"""

import enum
import time
import logging
from typing import Dict, Any, List

from app.core.spk_kernel import kernel, ModuleState

logger = logging.getLogger("smriti.operations.cluster")


class NodeRole(str, enum.Enum):
    LEADER = "LEADER"
    FOLLOWER = "FOLLOWER"
    CANDIDATE = "CANDIDATE"
    JOINING = "JOINING"


class ClusterNode:
    def __init__(self, node_id: str, address: str, role: NodeRole = NodeRole.FOLLOWER):
        self.node_id = node_id
        self.address = address
        self.role = role
        self.last_heartbeat = time.time()


class ClusterManager:
    """Multi-Node Cluster Manager (SMP-010 Compliant)."""

    def __init__(self, node_id: str = "node-primary-01"):
        self.self_node_id = node_id
        self.nodes: Dict[str, ClusterNode] = {}

        # Self registration
        self.nodes[self.self_node_id] = ClusterNode(self.self_node_id, "127.0.0.1:8000", NodeRole.LEADER)

    def register_node(self, node_id: str, address: str) -> ClusterNode:
        node = ClusterNode(node_id, address, NodeRole.FOLLOWER)
        self.nodes[node_id] = node
        logger.info("[ClusterManager] Registered node '%s' (%s).", node_id, address)
        return node

    def record_heartbeat(self, node_id: str) -> bool:
        if node_id in self.nodes:
            self.nodes[node_id].last_heartbeat = time.time()
            return True
        return False

    def get_cluster_status(self) -> Dict[str, Any]:
        """Returns node membership, roles, and cluster health."""
        leader = next((n.node_id for n in self.nodes.values() if n.role == NodeRole.LEADER), None)
        return {
            "cluster_size": len(self.nodes),
            "leader_node_id": leader,
            "nodes": [
                {
                    "node_id": n.node_id,
                    "address": n.address,
                    "role": n.role.value,
                    "healthy": (time.time() - n.last_heartbeat) < 15.0
                }
                for n in self.nodes.values()
            ]
        }
