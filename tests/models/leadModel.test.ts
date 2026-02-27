const leadModel = require('../../src/models/leadModel');
const supabase = require('../../src/config/database');

// Mocks
jest.mock('../../src/config/database', () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis()
}));

describe('Memoria Permanente (LeadModel - Medical History)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('Debe inicializar un arreglo y agregar un valor si la categoria no existe', async () => {
        // Mock de que el usuario existe pero no tiene medical_history previomente guardado
        supabase.single.mockResolvedValueOnce({ data: { phone: '123', medical_history: null } });

        // Mock the update operation successful return
        supabase.single.mockResolvedValueOnce({ data: { phone: '123', medical_history: { allergies: ['Pollo'] } } });

        await leadModel.updateMedicalHistory('123', 'allergies', 'Pollo');

        expect(supabase.update).toHaveBeenCalledWith({
            medical_history: { allergies: ['Pollo'] }
        });
    });

    it('Debe agregar a un arreglo existente sin duplicar', async () => {
        // Mock usuario ya tiene alergia al Pollo
        supabase.single.mockResolvedValueOnce({
            data: { phone: '123', medical_history: { allergies: ['Pollo'] } }
        });
        supabase.single.mockResolvedValueOnce({ data: true });

        // Intentar agregar Pollo de nuevo
        await leadModel.updateMedicalHistory('123', 'allergies', 'Pollo');

        // No debe duplicarse en el objeto que recibe .update()
        expect(supabase.update).toHaveBeenCalledWith({
            medical_history: { allergies: ['Pollo'] }
        });

        // Ahora intentar agregar Pescado
        supabase.single.mockResolvedValueOnce({
            data: { phone: '123', medical_history: { allergies: ['Pollo'] } }
        });
        supabase.single.mockResolvedValueOnce({ data: true });

        await leadModel.updateMedicalHistory('123', 'allergies', 'Pescado');

        expect(supabase.update).toHaveBeenCalledWith({
            medical_history: { allergies: ['Pollo', 'Pescado'] }
        });
    });

    it('Debe sobreescribir propiedades en categorias no agrupables (ej: behavior)', async () => {
        supabase.single.mockResolvedValueOnce({
            data: { phone: '123', medical_history: { behavior: 'Tranquilo' } }
        });
        supabase.single.mockResolvedValueOnce({ data: true });

        await leadModel.updateMedicalHistory('123', 'behavior', 'Nervioso');

        expect(supabase.update).toHaveBeenCalledWith({
            medical_history: { behavior: 'Nervioso' }
        });
    });
});
