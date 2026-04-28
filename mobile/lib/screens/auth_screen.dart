import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../main.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  int _step = 1;
  final _phoneController = TextEditingController();
  final _nameController = TextEditingController();
  bool _loading = false;

  Future<void> _completeSignup() async {
    setState(() => _loading = true);
    final String demoId = 'demo-mobile-${DateTime.now().millisecondsSinceEpoch}';
    
    try {
      // Register in backend
      await http.post(
        Uri.parse('http://localhost:3000/api/auth/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'id': demoId,
          'email': '${_nameController.text.replaceAll(' ', '').toLowerCase()}@demo.io',
          'full_name': _nameController.text.isEmpty ? 'Demo User' : _nameController.text,
          'wallet_address': '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
          'is_enterprise': false,
        }),
      );

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('zelcor_demo_id', demoId);

      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const MainScaffold()),
        );
      }
    } catch (e) {
      // Proceed anyway for demo
      if (mounted) {
         Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const MainScaffold()),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'zelcor',
                style: TextStyle(fontSize: 48, fontWeight: FontWeight.black, letterSpacing: -2, color: Color(0xFF00475e)),
              ),
              const SizedBox(height: 12),
              Text(
                _step == 1 ? 'Start Protecting' : _step == 2 ? 'Enter Phone' : 'Enter Name',
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 48),

              if (_step == 1) ...[
                _buildSocialButton('Continue with Google', 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg', () => setState(() => _step = 3)),
                const SizedBox(height: 16),
                _buildPhoneButton(),
              ],

              if (_step == 2) ...[
                TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  autofocus: true,
                  decoration: const InputDecoration(labelText: '98765 43210', border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16)))),
                ),
                const SizedBox(height: 24),
                _buildActionButton('Continue', () => setState(() => _step = 3)),
              ],

              if (_step == 3) ...[
                TextField(
                  controller: _nameController,
                  autofocus: true,
                  decoration: const InputDecoration(labelText: 'Full Name', border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16)))),
                ),
                const SizedBox(height: 24),
                _buildActionButton(_loading ? 'Initializing...' : 'Start Demo', _completeSignup),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSocialButton(String label, String iconUrl, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(border: Border.all(color: Colors.grey[200]!), borderRadius: BorderRadius.circular(16)),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.network(iconUrl, width: 24),
            const SizedBox(width: 12),
            Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  Widget _buildPhoneButton() {
    return InkWell(
      onTap: () => setState(() => _step = 2),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: const Color(0xFF00475e), borderRadius: BorderRadius.circular(16)),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.phone_iphone, color: Colors.white, size: 20),
            SizedBox(width: 12),
            Text('Continue with Phone', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton(String label, VoidCallback onTap) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: _loading ? null : onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF006782),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        child: Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }
}
