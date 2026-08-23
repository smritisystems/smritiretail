"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional, Union, Tuple


class GovernedRuleEngine:
    """
    Centralized, deterministic execution engine for versioned formulas, rules, policies, and workflows.
    STRICT SECURITY: No arbitrary code execution or eval(). Uses pure AST interpretation and condition trees.
    """

    @classmethod
    def evaluate_formula_ast(cls, ast: Dict[str, Any], params: Dict[str, Any]) -> Decimal:
        """
        Recursively evaluates a safe AST expression using decimal arithmetic.
        Supported node types:
          - {"type": "literal", "value": 100}
          - {"type": "param", "name": "base_price"}
          - {"type": "binary_op", "op": "+|-|*|/|%", "left": node, "right": node}
          - {"type": "func", "name": "round|min|max|abs", "args": [node, ...]}
        """
        if not isinstance(ast, dict):
            raise ValueError(f"AST node must be a dict, got {type(ast)}")

        node_type = ast.get("type")

        if node_type == "literal":
            return Decimal(str(ast["value"]))

        elif node_type == "param":
            pname = ast["name"]
            if pname not in params:
                raise ValueError(f"Missing required formula parameter: '{pname}'")
            val = params[pname]
            return Decimal(str(val)) if val is not None else Decimal("0.00")

        elif node_type == "binary_op":
            op = ast["op"]
            left_val = cls.evaluate_formula_ast(ast["left"], params)
            right_val = cls.evaluate_formula_ast(ast["right"], params)

            if op == "+":
                return left_val + right_val
            elif op == "-":
                return left_val - right_val
            elif op == "*":
                return left_val * right_val
            elif op == "/":
                if right_val == Decimal("0"):
                    raise ZeroDivisionError("Formula evaluation resulted in division by zero")
                return left_val / right_val
            elif op == "%":
                return left_val % right_val
            else:
                raise ValueError(f"Unsupported binary operator: {op}")

        elif node_type == "func":
            fname = ast["name"].lower()
            evaluated_args = [cls.evaluate_formula_ast(arg, params) for arg in ast.get("args", [])]

            if fname == "round":
                if not evaluated_args:
                    raise ValueError("round() requires at least 1 argument")
                val = evaluated_args[0]
                decimals = int(evaluated_args[1]) if len(evaluated_args) > 1 else 2
                q = Decimal("10") ** -decimals
                return val.quantize(q, rounding=ROUND_HALF_UP)

            elif fname == "min":
                return min(evaluated_args)

            elif fname == "max":
                return max(evaluated_args)

            elif fname == "abs":
                return abs(evaluated_args[0])

            else:
                raise ValueError(f"Unsupported formula function: {fname}")

        else:
            raise ValueError(f"Unknown AST node type: {node_type}")

    @classmethod
    def evaluate_condition_tree(cls, condition: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """
        Recursively evaluates a boolean condition tree.
        Supported structures:
          - {"all": [cond1, cond2]} (Logical AND)
          - {"any": [cond1, cond2]} (Logical OR)
          - {"not": cond} (Logical NOT)
          - {"field": "order_total", "op": ">=|>|<|<=|==|!=|in|not_in", "value": 500}
        """
        if not isinstance(condition, dict):
            return False

        if "all" in condition:
            return all(cls.evaluate_condition_tree(c, context) for c in condition["all"])

        if "any" in condition:
            return any(cls.evaluate_condition_tree(c, context) for c in condition["any"])

        if "not" in condition:
            return not cls.evaluate_condition_tree(condition["not"], context)

        if "field" in condition:
            field_name = condition["field"]
            op = condition.get("op", "==")
            expected = condition.get("value")
            actual = context.get(field_name)

            if actual is None:
                return False

            # Convert to Decimal for numeric comparisons if expected is numeric
            if isinstance(expected, (int, float, Decimal)) and isinstance(actual, (int, float, Decimal, str)):
                try:
                    actual = Decimal(str(actual))
                    expected = Decimal(str(expected))
                except Exception:
                    pass

            if op == "==":
                return actual == expected
            elif op == "!=":
                return actual != expected
            elif op == ">":
                return actual > expected
            elif op == ">=":
                return actual >= expected
            elif op == "<":
                return actual < expected
            elif op == "<=":
                return actual <= expected
            elif op == "in":
                return actual in expected
            elif op == "not_in":
                return actual not in expected
            else:
                raise ValueError(f"Unsupported condition operator: {op}")

        return True

    @classmethod
    def evaluate_business_rule(
        cls,
        conditions: Dict[str, Any],
        actions: List[Dict[str, Any]],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Evaluates a business rule against context. If conditions match, calculates actions.
        Returns {"matched": bool, "applied_actions": [...], "calculated_discount": Decimal}
        """
        matched = cls.evaluate_condition_tree(conditions, context)
        if not matched:
            return {"matched": False, "applied_actions": [], "calculated_discount": Decimal("0.00")}

        applied = []
        total_discount = Decimal("0.00")
        base_amount = Decimal(str(context.get("order_amount", 0)))

        for act in actions:
            act_type = act.get("type")
            if act_type == "PERCENT_DISCOUNT":
                pct = Decimal(str(act.get("value", 0)))
                disc = (base_amount * pct / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                total_discount += disc
                applied.append({"type": act_type, "percent": pct, "amount": disc})

            elif act_type == "FLAT_DISCOUNT":
                flat = Decimal(str(act.get("value", 0))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                total_discount += flat
                applied.append({"type": act_type, "amount": flat})

            elif act_type == "FREE_SHIPPING":
                applied.append({"type": act_type, "value": True})

        return {
            "matched": True,
            "applied_actions": applied,
            "calculated_discount": total_discount
        }

    @classmethod
    def evaluate_gst_tax_policy(
        cls,
        line_items: List[Dict[str, Any]],
        supplier_state_code: str,
        recipient_state_code: str,
        policy_parameters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Statutory GST Tax Calculation Policy.
        Determines Intrastate (CGST+SGST) vs Interstate (IGST) split with rounding rules.
        """
        is_intrastate = (supplier_state_code == recipient_state_code)
        taxable_total = Decimal("0.00")
        cgst_total = Decimal("0.00")
        sgst_total = Decimal("0.00")
        igst_total = Decimal("0.00")
        line_results = []

        for item in line_items:
            qty = Decimal(str(item.get("quantity", 1)))
            unit_price = Decimal(str(item.get("unit_price", 0)))
            discount = Decimal(str(item.get("discount_amount", 0)))
            taxable_line = (qty * unit_price) - discount
            taxable_line = max(Decimal("0.00"), taxable_line)
            tax_rate = Decimal(str(item.get("tax_rate", 0)))

            if is_intrastate:
                half_rate = (tax_rate / Decimal("2")).quantize(Decimal("0.01"))
                cgst_line = (taxable_line * half_rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                sgst_line = (taxable_line * half_rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                igst_line = Decimal("0.00")
            else:
                cgst_line = Decimal("0.00")
                sgst_line = Decimal("0.00")
                igst_line = (taxable_line * tax_rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            total_tax_line = cgst_line + sgst_line + igst_line
            line_total = taxable_line + total_tax_line

            taxable_total += taxable_line
            cgst_total += cgst_line
            sgst_total += sgst_line
            igst_total += igst_line

            line_results.append({
                "item_id": item.get("item_id"),
                "taxable_amount": taxable_line,
                "tax_rate": tax_rate,
                "cgst_amount": cgst_line,
                "sgst_amount": sgst_line,
                "igst_amount": igst_line,
                "total_tax": total_tax_line,
                "line_total": line_total
            })

        grand_total = taxable_total + cgst_total + sgst_total + igst_total

        return {
            "is_intrastate": is_intrastate,
            "supplier_state": supplier_state_code,
            "recipient_state": recipient_state_code,
            "taxable_total": taxable_total,
            "cgst_total": cgst_total,
            "sgst_total": sgst_total,
            "igst_total": igst_total,
            "total_tax": cgst_total + sgst_total + igst_total,
            "grand_total": grand_total,
            "line_items": line_results
        }

    @classmethod
    def evaluate_workflow_transition(
        cls,
        workflow_def: Dict[str, Any],
        current_state: str,
        action: str,
        user_roles: List[str]
    ) -> Dict[str, Any]:
        """
        Validates state machine transitions against versioned workflow definition and user roles.
        """
        transitions = workflow_def.get("transitions", [])
        matched_trans = next(
            (t for t in transitions if t.get("from") == current_state and t.get("action") == action),
            None
        )

        if not matched_trans:
            return {
                "allowed": False,
                "next_state": None,
                "error": f"Invalid transition: No transition from state '{current_state}' with action '{action}'"
            }

        required_roles = matched_trans.get("required_roles", [])
        if required_roles:
            user_roles_upper = [r.upper() for r in user_roles]
            has_role = any(req.upper() in user_roles_upper for req in required_roles)
            if not has_role:
                return {
                    "allowed": False,
                    "next_state": None,
                    "error": f"Permission denied: Action '{action}' requires one of {required_roles}, user has {user_roles}"
                }

        return {
            "allowed": True,
            "next_state": matched_trans.get("to"),
            "action": action,
            "error": None
        }
