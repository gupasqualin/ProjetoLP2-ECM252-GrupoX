import 'package:flutter/material.dart';

import 'servicos/decision_api.dart';
import 'telas/empresas_tela.dart';

void main() {
  runApp(DecisionDcfApp(api: DecisionApi()));
}

class DecisionDcfApp extends StatelessWidget {
  const DecisionDcfApp({super.key, required this.api});

  final DecisionApi api;

  @override
  Widget build(BuildContext context) {
    const semente = Color(0xFF0F5C4D);
    return MaterialApp(
      title: 'DecisionDCF',
      debugShowCheckedModeBanner: false,
      theme: _tema(ColorScheme.fromSeed(seedColor: semente)),
      darkTheme: _tema(
        ColorScheme.fromSeed(seedColor: semente, brightness: Brightness.dark),
      ),
      home: InicioTela(api: api),
    );
  }

  ThemeData _tema(ColorScheme cores) => ThemeData(
    colorScheme: cores,
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(),
    ),
    cardTheme: const CardThemeData(margin: EdgeInsets.zero),
  );
}

/// Tela principal com a navegação entre as funcionalidades.
class InicioTela extends StatefulWidget {
  const InicioTela({super.key, required this.api});

  final DecisionApi api;

  @override
  State<InicioTela> createState() => _InicioTelaState();
}

class _InicioTelaState extends State<InicioTela> {
  int _aba = 0;

  @override
  Widget build(BuildContext context) {
    // Cada aba é recriada ao ser aberta, para sempre mostrar dados atualizados.
    final telas = <Widget>[EmpresasTela(api: widget.api)];

    return Scaffold(
      body: telas[_aba],
      bottomNavigationBar: telas.length < 2
          ? null
          : NavigationBar(
              selectedIndex: _aba,
              onDestinationSelected: (aba) => setState(() => _aba = aba),
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.business_outlined),
                  selectedIcon: Icon(Icons.business),
                  label: 'Empresas',
                ),
              ],
            ),
    );
  }
}
