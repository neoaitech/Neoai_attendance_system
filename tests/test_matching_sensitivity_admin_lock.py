import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.db.models import User, SystemSetting
from backend.app.core.security import get_password_hash, create_access_token

client = TestClient(app)

def test_institutional_matching_sensitivity_admin_lock():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == 'admin_test_sens').first()
        if not admin:
            admin = User(
                username='admin_test_sens',
                email='admin_test_sens@example.com',
                hashed_password=get_password_hash('AdminPass123!'),
                full_name='Admin Test Sensitivity',
                role='admin',
                is_active=True
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)

        teacher = db.query(User).filter(User.username == 'teacher_test_sens').first()
        if not teacher:
            teacher = User(
                username='teacher_test_sens',
                email='teacher_test_sens@example.com',
                hashed_password=get_password_hash('TeacherPass123!'),
                full_name='Teacher Test Sensitivity',
                role='teacher',
                is_active=True
            )
            db.add(teacher)
            db.commit()
            db.refresh(teacher)

        admin_token = create_access_token(admin.username, role=admin.role)
        teacher_token = create_access_token(teacher.username, role=teacher.role)

        admin_headers = {'Authorization': f'Bearer {admin_token}'}
        teacher_headers = {'Authorization': f'Bearer {teacher_token}'}

        # 1. Fetch default/existing sensitivity setting
        res = client.get('/api/admin/system-settings/matching-sensitivity', headers=teacher_headers)
        assert res.status_code == 200
        data = res.json()
        assert 'tolerance' in data
        assert data['is_locked'] is True

        # 2. Teacher tries to change setting -> Should be rejected (403 Forbidden)
        res_forbidden = client.post(
            '/api/admin/system-settings/matching-sensitivity',
            json={'tolerance': 0.58, 'label': 'Strict High Security (0.58)'},
            headers=teacher_headers
        )
        assert res_forbidden.status_code == 403

        # 3. Admin updates and locks setting to 0.58
        res_admin = client.post(
            '/api/admin/system-settings/matching-sensitivity',
            json={'tolerance': 0.58, 'label': 'Strict High Security (0.58)'},
            headers=admin_headers
        )
        assert res_admin.status_code == 200
        admin_data = res_admin.json()
        assert admin_data['success'] is True
        assert admin_data['tolerance'] == 0.58
        assert 'Strict High Security' in admin_data['label']

        # 4. Verify setting persists in database and is visible to teacher
        res_check = client.get('/api/admin/system-settings/matching-sensitivity', headers=teacher_headers)
        assert res_check.status_code == 200
        check_data = res_check.json()
        assert check_data['tolerance'] == 0.58
        assert 'Strict High Security' in check_data['label']

        # 5. Admin resets back to Standard Balanced 0.50
        res_reset = client.post(
            '/api/admin/system-settings/matching-sensitivity',
            json={'tolerance': 0.50, 'label': 'Standard Balanced (0.50 - Recommended)'},
            headers=admin_headers
        )
        assert res_reset.status_code == 200
        assert res_reset.json()['tolerance'] == 0.50

    finally:
        db.close()
