#!/usr/bin/env python3
"""
Embedding服务测试脚本
"""

import requests
import json

EMBEDDING_SERVICE_URL = "http://localhost:8000"

def test_health():
    print("\n=== 测试健康检查 ===")
    try:
        response = requests.get(f"{EMBEDDING_SERVICE_URL}/health")
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ 失败: {e}")
        return False

def test_embeddings():
    print("\n=== 测试Embedding生成 ===")
    try:
        data = {
            "texts": [
                "这是一段测试文本",
                "人工智能技术发展迅速",
                "机器学习是AI的重要分支"
            ]
        }
        response = requests.post(
            f"{EMBEDDING_SERVICE_URL}/embeddings",
            json=data
        )
        print(f"状态码: {response.status_code}")
        result = response.json()
        print(f"生成了 {len(result['embeddings'])} 个向量")
        print(f"向量维度: {len(result['embeddings'][0])}")
        print(f"第一个向量前5维: {result['embeddings'][0][:5]}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ 失败: {e}")
        return False

if __name__ == "__main__":
    print("========================================")
    print("Embedding服务测试")
    print("========================================")
    
    health_ok = test_health()
    embeddings_ok = test_embeddings()
    
    print("\n========================================")
    print("测试结果")
    print("========================================")
    print(f"健康检查: {'✅ 通过' if health_ok else '❌ 失败'}")
    print(f"Embedding生成: {'✅ 通过' if embeddings_ok else '❌ 失败'}")
    print()
