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

describe('Memoria Permanente (LeadModel - Medical History Multi-Pet)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('Debe inicializar un arreglo de mascotas y agregar un valor', async () => {
        supabase.single.mockResolvedValueOnce({ data: { phone: '123', medical_history: null } });
        supabase.single.mockResolvedValueOnce({ data: true });

        await leadModel.updateMedicalHistory('123', 'allergies', 'Pollo', 'Baly');

        expect(supabase.update).toHaveBeenCalledWith({
            medical_history: {
                pets: [{ name: 'Baly', allergies: ['Pollo'], behavior: '', preferences: [], notes: '' }]
            }
        });
    });

    it('Debe agregar a una mascota existente sin duplicar alergias', async () => {
        supabase.single.mockResolvedValueOnce({
            data: {
                phone: '123',
                medical_history: { pets: [{ name: 'Baly', allergies: ['Pollo'], behavior: '', preferences: [], notes: '' }] }
            }
        });
        supabase.single.mockResolvedValueOnce({ data: true });

        await leadModel.updateMedicalHistory('123', 'allergies', 'Pollo', 'Baly');

        expect(supabase.update).toHaveBeenCalledWith({
            medical_history: {
                pets: [{ name: 'Baly', allergies: ['Pollo'], behavior: '', preferences: [], notes: '' }]
            }
        });
    });

    it('Debe manejar múltiples mascotas independientes', async () => {
        supabase.single.mockResolvedValueOnce({
            data: {
                phone: '123',
                medical_history: { pets: [{ name: 'Baly', allergies: ['Pollo'], behavior: '', preferences: [], notes: '' }] }
            }
        });
        supabase.single.mockResolvedValueOnce({ data: true });

        await leadModel.updateMedicalHistory('123', 'behavior', 'Tranquila', 'Luna');

        const updateCall = supabase.update.mock.calls[0][0];
        expect(updateCall.medical_history.pets).toHaveLength(2);
        expect(updateCall.medical_history.pets.find(p => p.name === 'Luna').behavior).toBe('Tranquila');
    });
});
