import os

from flask import Flask, jsonify

from kernel.SB688_ENGINE import SB688Engine
from nodes.node import Node


node_id = int(os.getenv("NODE_ID", "0"))
port = 5000 + node_id

engine = SB688Engine()
node = Node(node_id, engine, peers=[])

app = Flask(__name__)


@app.route("/status")
def status():
    return jsonify(node.get_state())


@app.route("/corrupt", methods=["POST"])
def corrupt():
    node.engine.inject_corruption(percent=99.8)
    return jsonify({"status": "corruption_injected"})


@app.route("/heal", methods=["POST"])
def heal():
    events = list(node.engine.heal_from_spine())
    return jsonify({"healing_complete": len(events) > 0, "events": len(events)})


@app.route("/ledger")
def ledger():
    return jsonify({"ledger": node.engine.get_ledger()})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=port, debug=False)
