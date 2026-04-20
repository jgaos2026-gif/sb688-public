import os

from flask import Flask, jsonify, request

from kernel.SB688_ENGINE import SB688Engine
from nodes.node import Node


node_id = int(os.getenv("NODE_ID", "0"))
port = 5000 + node_id

engine = SB688Engine()
node = Node(node_id, engine, peers=[])

app = Flask(__name__)


@app.route("/status")
def status():
    include_sensitive = request.args.get("include_sensitive", "false").lower() == "true"
    try:
        return jsonify(node.get_state(include_sensitive=include_sensitive))
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403


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
    try:
        return jsonify({"ledger": node.engine.get_ledger()})
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403


@app.route("/unlock", methods=["POST"])
def unlock():
    code = request.json.get("code", "") if request.json else ""
    success = node.engine.unlock_sensitive_access(code)
    return jsonify({"unlocked": success}), 200 if success else 401


@app.route("/lock", methods=["POST"])
def lock():
    node.engine.lock_sensitive_access()
    return jsonify({"locked": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=port, debug=False)
