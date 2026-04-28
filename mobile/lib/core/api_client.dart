import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio _dio;
  String _baseUrl = 'http://localhost:3000';

  ApiClient._internal() {
    _dio = Dio(
      BaseOptions(
        baseUrl: _baseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
        },
      ),
    );

    if (kDebugMode) {
      _dio.interceptors.add(LogInterceptor(
        requestBody: true,
        responseBody: true,
      ));
    }
  }

  void setBaseUrl(String url) {
    _baseUrl = url;
    _dio.options.baseUrl = url;
  }

  void setAuthToken(String token) {
    _dio.options.headers['Authorization'] = 'Bearer $token';
  }

  // Auth
  Future<Response> register(Map<String, dynamic> data) async {
    return _dio.post('/api/auth/register', data: data);
  }

  Future<Response> login(Map<String, dynamic> data) async {
    return _dio.post('/api/auth/login', data: data);
  }

  // Transactions
  Future<Response> getUserTransactions(String userId) async {
    return _dio.get('/api/user/transactions', queryParameters: {'user_id': userId});
  }

  Future<Response> createTransaction(Map<String, dynamic> data) async {
    return _dio.post('/api/transactions/create', data: data);
  }

  Future<Response> confirmReceipt(String transactionId) async {
    return _dio.post('/api/transactions/confirm', data: {'transaction_id': transactionId});
  }

  // Complaints
  Future<Response> fileComplaint(Map<String, dynamic> data) async {
    return _dio.post('/api/complaints/file', data: data);
  }

  Future<Response> getComplaint(String id) async {
    return _dio.get('/api/complaints/$id');
  }

  Future<Response> claimRefund(String transactionId) async {
    return _dio.post('/api/complaints/refund', data: {'transaction_id': transactionId});
  }

  // Company
  Future<Response> companyRespond(Map<String, dynamic> data) async {
    return _dio.post('/api/company/respond', data: data);
  }

  Future<Response> getCompanyDashboard(String companyId) async {
    return _dio.get('/api/company/dashboard', queryParameters: {'company_id': companyId});
  }

  Future<Response> getAnalytics(String companyId) async {
    return _dio.get('/api/analytics/$companyId');
  }

  // Health
  Future<Response> healthCheck() async {
    return _dio.get('/api/health');
  }
}