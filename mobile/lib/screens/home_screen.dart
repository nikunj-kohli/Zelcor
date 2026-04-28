import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? _profile;
  List<dynamic> _escrows = [];
  bool _loading = true;
  final String _apiUrl = 'http://localhost:3000/api';

  // Zelcor Theme Colors
  static const Color primaryBlue = Color(0xFF1A5F7A);
  static const Color secondaryBlue = Color(0xFF006782);
  static const Color mintGreen = Color(0xFF2E8A57);
  static const Color coralRed = Color(0xFFF27A6B);
  static const Color amberGold = Color(0xFFF2C94C);
  static const Color bgColor = Color(0xFFF8F9FC);

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    final session = Supabase.instance.client.auth.currentSession;
    final prefs = await SharedPreferences.getInstance();
    final demoId = prefs.getString('zelcor_demo_id');
    
    final userId = session?.user?.id ?? demoId;
    if (userId == null) return;

    try {
      final profileRes = await http.get(Uri.parse('$_apiUrl/auth/profile/$userId'));
      final escrowsRes = await http.get(Uri.parse('$_apiUrl/user/escrows?user_id=$userId'));

      if (mounted) {
        setState(() {
          _profile = jsonDecode(profileRes.body)['profile'];
          _escrows = jsonDecode(escrowsRes.body)['escrows'] ?? [];
          _loading = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching data: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: bgColor,
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: primaryBlue, strokeWidth: 3),
              SizedBox(height: 20),
              Text('ZELCOR TRUST', style: TextStyle(color: primaryBlue, fontWeight: FontWeight.w900, letterSpacing: 4)),
            ],
          ),
        ),
      );
    }

    final String fullName = _profile?['full_name'] ?? 'User';
    final String firstName = fullName.split(' ')[0];
    
    final double totalProtected = _escrows
        .where((e) => e['status'] == 'active' || e['status'] == 'disputed')
        .fold(0.0, (sum, e) => sum + (double.tryParse(e['amount'].toString()) ?? 0.0));

    return Scaffold(
      backgroundColor: bgColor,
      bottomNavigationBar: _buildBottomNav(),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _fetchData,
          color: primaryBlue,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 24),
                _buildHeader(firstName, fullName),
                const SizedBox(height: 32),
                _buildTrustSummary(),
                const SizedBox(height: 32),
                _buildStatsGrid(totalProtected),
                const SizedBox(height: 32),
                _buildQuickActions(),
                const SizedBox(height: 32),
                _buildActiveEscrows(),
                const SizedBox(height: 32),
                _buildRecentActivity(),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(String firstName, String fullName) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('TRUST, ENCODED.', style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 2)),
            const SizedBox(height: 4),
            Text('Hello, $firstName', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, letterSpacing: -1, color: Color(0xFF191C1E))),
          ],
        ),
        Container(
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: primaryBlue.withOpacity(0.1), width: 2)),
          child: CircleAvatar(
            radius: 24,
            backgroundColor: primaryBlue.withOpacity(0.05),
            child: Text(fullName[0], style: const TextStyle(fontWeight: FontWeight.w900, color: primaryBlue, fontSize: 18)),
          ),
        ),
      ],
    );
  }

  Widget _buildTrustSummary() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 20, offset: const Offset(0, 10))],
      ),
      child: Row(
        children: [
          _buildScoreCircle(),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text('95.0', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: primaryBlue)),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: mintGreen.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
                      child: const Row(
                        children: [
                          Icon(Icons.arrow_upward, color: mintGreen, size: 10),
                          Text('+2.4', style: TextStyle(color: mintGreen, fontSize: 10, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ],
                ),
                const Text('GOLD PROTECTOR', style: TextStyle(color: amberGold, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: Colors.grey),
        ],
      ),
    );
  }

  Widget _buildScoreCircle() {
    return Container(
      width: 50,
      height: 50,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: primaryBlue.withOpacity(0.1), width: 4),
      ),
      child: const Center(child: Icon(Icons.psychology, color: primaryBlue, size: 24)),
    );
  }

  Widget _buildStatsGrid(double totalProtected) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 16,
      mainAxisSpacing: 16,
      childAspectRatio: 1.4,
      children: [
        _buildStatCard('PROTECTED', '₹${totalProtected.toInt()}', Icons.shield, primaryBlue),
        _buildStatCard('ESCROWS', '${_escrows.length}', Icons.lock, secondaryBlue),
        _buildStatCard('REFUNDED', '₹1,200', Icons.undo, coralRed),
        _buildStatCard('TRUST', 'TOP 10%', Icons.emoji_events, amberGold),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.withOpacity(0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.between,
            children: [
              Text(label, style: const TextStyle(color: Colors.grey, fontSize: 8, fontWeight: FontWeight.w900, letterSpacing: 1)),
              Icon(icon, color: color, size: 16),
            ],
          ),
          const Spacer(),
          Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, letterSpacing: -0.5)),
        ],
      ),
    );
  }

  Widget _buildQuickActions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('QUICK ACTIONS', style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 2)),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _buildActionCircle(Icons.add_circle, 'New Claim', primaryBlue),
            _buildActionCircle(Icons.qr_code_scanner, 'Scan Bill', mintGreen),
            _buildActionCircle(Icons.verified, 'Proof', amberGold),
            _buildActionCircle(Icons.history, 'Refunds', coralRed),
          ],
        ),
      ],
    );
  }

  Widget _buildActionCircle(IconData icon, String label, Color color) {
    return Column(
      children: [
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [BoxShadow(color: color.withOpacity(0.2), blurRadius: 10, offset: const Offset(0, 4))],
          ),
          child: Icon(icon, color: Colors.white, size: 24),
        ),
        const SizedBox(height: 10),
        Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B))),
      ],
    );
  }

  Widget _buildActiveEscrows() {
    final active = _escrows.where((e) => e['status'] == 'active' || e['status'] == 'disputed').toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.between,
          children: [
            const Text('ACTIVE PROTECTIONS', style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 2)),
            TextButton(onPressed: () {}, child: const Text('View All', style: TextStyle(color: primaryBlue, fontSize: 10, fontWeight: FontWeight.w900))),
          ],
        ),
        const SizedBox(height: 12),
        if (active.isEmpty)
          _buildEmptyEscrow()
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: active.length,
            separatorBuilder: (context, index) => const SizedBox(height: 12),
            itemBuilder: (context, index) => _buildEscrowTile(active[index]),
          ),
      ],
    );
  }

  Widget _buildEmptyEscrow() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32), border: Border.all(color: Colors.grey.withOpacity(0.05))),
      child: Column(
        children: [
          Icon(Icons.shield_moon, color: Colors.grey[200], size: 48),
          const SizedBox(height: 16),
          const Text('Your shopping is safe', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
          const Text('Pay through Zelcor to protect your purchase', style: TextStyle(color: Colors.grey, fontSize: 10), textAlign: TextAlign.center),
        ],
      ),
    );
  }

  Widget _buildEscrowTile(dynamic item) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10)]),
      child: Row(
        children: [
          Container(width: 48, height: 48, decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(16)), child: const Icon(Icons.shopping_bag, color: Colors.grey)),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item['item_name'], style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                Text(item['status'].toString().toUpperCase(), style: const TextStyle(color: primaryBlue, fontSize: 8, fontWeight: FontWeight.w900, letterSpacing: 1)),
              ],
            ),
          ),
          Text('₹${item['amount']}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        ],
      ),
    );
  }

  Widget _buildRecentActivity() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('RECENT ACTIVITY', style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 2)),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32)),
          child: Column(
            children: [
              _buildActivityRow('Refund received', '₹1,200', 'Today', mintGreen, Icons.undo),
              const Divider(height: 32),
              _buildActivityRow('Complaint filed', '₹15,000', 'Yesterday', coralRed, Icons.gavel),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildActivityRow(String title, String amount, String date, Color color, IconData icon) {
    return Row(
      children: [
        Container(width: 36, height: 36, decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: color, size: 18)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12)), Text(date, style: const TextStyle(color: Colors.grey, fontSize: 9))])),
        Text(amount, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
      ],
    );
  }

  Widget _buildBottomNav() {
    return Container(
      height: 80,
      decoration: BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Colors.grey.withOpacity(0.05)))),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _navIcon(Icons.home_filled, true),
          _navIcon(Icons.lock, false),
          _navIcon(Icons.gavel, false),
          _navIcon(Icons.person, false),
        ],
      ),
    );
  }

  Widget _navIcon(IconData icon, bool active) {
    return Icon(icon, color: active ? primaryBlue : Colors.grey[300], size: 28);
  }
}
