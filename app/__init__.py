from flask import Flask
from .routes import main as main_routes
from .model import db
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from .utils.summary_queue import init_app as init_summary_queue

def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
    

    app.config.from_mapping(
        SECRET_KEY='your_secret_key',
        # 数据库配置
        SQLALCHEMY_DATABASE_URI='postgresql://postgres:pjgsas16@8.153.86.207:5432/py_helper',
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        # 会话配置
        SESSION_TYPE='filesystem',
        PERMANENT_SESSION_LIFETIME=86400,  # 默认会话生命周期（24小时）
    )

    # 从环境变量加载配置
    app.config.from_prefixed_env("FLASK")

    # 初始化数据库
    db.init_app(app)
    app.config["JWT_SECRET_KEY"] = app.config.get("SECRET_KEY", "default-secret-key")
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 86400  # 令牌过期时间，单位为秒
    jwt = JWTManager(app)
    # 注册主路由蓝图
    app.register_blueprint(main_routes)

    # 注册用户API蓝图
    from .api.user import user_bp
    app.register_blueprint(user_bp, url_prefix='/api/user')

    from .api.code import code_bp
    app.register_blueprint(code_bp, url_prefix='/api/code')

    from .api.note import note_bp
    app.register_blueprint(note_bp)

    from .api.homepage import homepage_bp
    app.register_blueprint(homepage_bp)

    
    from .api.learn import learn_bp
    app.register_blueprint(learn_bp, url_prefix='/api/learn')

    from .api.study import study_bp
    app.register_blueprint(study_bp)
    # 创建数据库表
    with app.app_context():
        db.create_all()
    init_summary_queue(app)
    return app

