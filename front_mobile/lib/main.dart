import 'package:flutter/material.dart';

import 'servicos/decision_api.dart';
import 'telas/dados_mercado_tela.dart';
import 'telas/empresas_tela.dart';
import 'telas/premissas_tela.dart';
import 'telas/sensibilidade_tela.dart';
import 'telas/valuation_tela.dart';

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
    final api = widget.api;
    // Cada aba é recriada ao ser aberta, para sempre mostrar dados atualizados.
    final abas = <(String, IconData, IconData, Widget Function())>[
      (
        'Empresas',
        Icons.business_outlined,
        Icons.business,
        () => EmpresasTela(api: api),
      ),
      (
        'Mercado',
        Icons.show_chart_outlined,
        Icons.show_chart,
        () => DadosMercadoTela(api: api),
      ),
      (
        'Premissas',
        Icons.tune_outlined,
        Icons.tune,
        () => PremissasTela(api: api),
      ),
      (
        'Valuation',
        Icons.calculate_outlined,
        Icons.calculate,
        () => ValuationTela(api: api),
      ),
      (
        'Cenários',
        Icons.grid_view_outlined,
        Icons.grid_view,
        () => SensibilidadeTela(api: api),
      ),
    ];

    return Scaffold(
      body: KeyedSubtree(key: ValueKey(_aba), child: abas[_aba].$4()),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _aba,
        onDestinationSelected: (aba) => setState(() => _aba = aba),
        destinations: [
          for (final (rotulo, icone, iconeSelecionado, _) in abas)
            NavigationDestination(
              icon: Icon(icone),
              selectedIcon: Icon(iconeSelecionado),
              label: rotulo,
            ),
        ],
      ),
    );
  }
}
