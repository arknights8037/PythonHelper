from app import create_app
import os

if __name__ == '__main__':
    app = create_app()

    host = os.environ.get('FLASK_HOST', '127.0.0.1')
    port = int(os.environ.get('FLASK_PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    
    # 运行应用
    app.run(host=host, port=port, debug=debug, )