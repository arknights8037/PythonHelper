import pymysql
import time
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

# 数据库连接字符串
DB_URI = 'mysql+pymysql://py_helper:pjgsas16@101.132.60.186:3306/py_helper'

def test_pymysql_connection():
    """使用PyMySQL直接测试连接"""
    print("=== 测试 PyMySQL 直接连接 ===")
    try:
        # 从连接字符串中提取连接信息
        # 移除 'mysql+pymysql://' 部分
        conn_info = DB_URI.replace('mysql+pymysql://', '')
        
        # 分离用户凭证和主机信息
        auth, host_info = conn_info.split('@')
        username, password = auth.split(':')
        
        # 分离主机和数据库名
        if '/' in host_info:
            host_port, dbname = host_info.split('/')
        else:
            host_port = host_info
            dbname = None
            
        # 分离主机和端口
        if ':' in host_port:
            host, port = host_port.split(':')
            port = int(port)
        else:
            host = host_port
            port = 3306  # MySQL默认端口
        
        start_time = time.time()
        
        # 建立连接
        conn = pymysql.connect(
            host=host,
            user=username,
            password=password,
            database=dbname,
            port=port
        )
        
        with conn.cursor() as cursor:
            # 执行简单查询
            cursor.execute("SELECT VERSION()")
            result = cursor.fetchone()
            
        conn.close()
        
        end_time = time.time()
        print(f"✓ 连接成功！MySQL 版本: {result[0]}")
        print(f"  连接时间: {(end_time - start_time):.2f} 秒")
        return True
        
    except Exception as e:
        print(f"✗ 连接失败: {str(e)}")
        return False

def test_sqlalchemy_connection():
    """使用SQLAlchemy测试连接"""
    print("\n=== 测试 SQLAlchemy 连接 ===")
    try:
        start_time = time.time()
        
        # 创建引擎
        engine = create_engine(DB_URI)
        
        # 测试连接
        with engine.connect() as connection:
            result = connection.execute(text("SELECT VERSION()"))
            version = result.scalar()
            
        end_time = time.time()
        print(f"✓ 连接成功！MySQL 版本: {version}")
        print(f"  连接时间: {(end_time - start_time):.2f} 秒")
        
        # 尝试列出所有表
        print("\n数据库中的表:")
        with engine.connect() as connection:
            result = connection.execute(text("SHOW TABLES"))
            tables = result.fetchall()
            
        if tables:
            for i, table in enumerate(tables):
                print(f"  {i+1}. {table[0]}")
                
            # 检查userinfo表结构
            if any(table[0] == 'userinfo' for table in tables):
                print("\n用户表结构:")
                with engine.connect() as connection:
                    result = connection.execute(text("DESCRIBE userinfo"))
                    columns = result.fetchall()
                for column in columns:
                    print(f"  {column[0]} - {column[1]} - {'NULL' if column[2] == 'YES' else 'NOT NULL'} - {column[3]}")
        else:
            print("  没有找到表")
            
        return True
    
    except SQLAlchemyError as e:
        print(f"✗ SQLAlchemy 连接失败: {str(e)}")
        return False
    
    except Exception as e:
        print(f"✗ 发生未知错误: {str(e)}")
        return False

if __name__ == "__main__":
    print("数据库连接测试")
    print("===============")
    print(f"连接URI: {DB_URI}")
    print("===============\n")
    
    # 测试PyMySQL直接连接
    pymysql_result = test_pymysql_connection()
    
    # 测试SQLAlchemy连接
    sqlalchemy_result = test_sqlalchemy_connection()
    
    # 总结
    print("\n===============")
    print("测试结果摘要:")
    print(f"PyMySQL 直接连接: {'成功 ✓' if pymysql_result else '失败 ✗'}")
    print(f"SQLAlchemy 连接: {'成功 ✓' if sqlalchemy_result else '失败 ✗'}")
    print("===============")