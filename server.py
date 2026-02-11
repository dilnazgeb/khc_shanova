#!/usr/bin/env python3
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

@app.route('/api/analyze-report', methods=['POST'])
def analyze():
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'no file'}), 400
    return jsonify({
        'projectId': 'demo-12345678',
        'project_info': {
            'full_name': 'Demo Project',
            'code': 'ДПГ-21-01',
            'customer': 'ООО Demo',
            'report_period': '202512',
            'location': 'Город'
        },
        'project_status': 'тревожный',
        'metrics': {
            'SMR_completion': 46.69,
            'GPR_delay_percent': 13.33,
            'GPR_delay_days': 40,
            'DDU_payments_percent': [47.07],
            'guarantee_extension': False
        },
        'reasoning': ['СМР низко', 'ГПР в срок', 'ДДУ недостаточно'],
        'triggered_conditions': ['low_smr']
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=False)
