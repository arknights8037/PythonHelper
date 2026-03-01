from functools import wraps
from flask import session, jsonify

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'uid' not in session:
            return jsonify({'code': 401, 'msg': '未登录或登录已过期'})
        return f(*args, **kwargs)
    return decorated_function