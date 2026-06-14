import { Test } from '@nestjs/testing';
import { StripeService } from './stripe.service';
import { STRIPE_CLIENT_TOKEN } from './stripe.constants';

describe('StripeService', () => {
  let service: StripeService;
  let stripeMock: any;

  beforeEach(async () => {
    stripeMock = {
      customers: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
      checkout: {
        sessions: {
          create: jest.fn(),
        },
      },
      subscriptions: {
        create: jest.fn(),
        retrieve: jest.fn(),
        cancel: jest.fn(),
      },
      billingPortal: {
        sessions: {
          create: jest.fn(),
        },
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: STRIPE_CLIENT_TOKEN,
          useValue: stripeMock,
        },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCustomer', () => {
    it('should call stripeClient.customers.create with correct params', async () => {
      stripeMock.customers.create.mockResolvedValue({ id: 'cus_123', email: 'test@example.com' });
      const customer = await service.createCustomer('test@example.com', 'Test User', { orgId: 'org_123' });
      expect(customer.id).toBe('cus_123');
      expect(stripeMock.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { orgId: 'org_123' },
      });
    });
  });

  describe('createSubscriptionCheckoutSession', () => {
    it('should call stripeClient.checkout.sessions.create in subscription mode', async () => {
      const mockSession = { id: 'sess_123', url: 'https://stripe.checkout/123' };
      stripeMock.checkout.sessions.create.mockResolvedValue(mockSession);

      const session = await service.createSubscriptionCheckoutSession({
        successUrl: 'https://success',
        cancelUrl: 'https://cancel',
        lineItems: [{ price: 'price_123', quantity: 1 }],
        customerId: 'cus_123',
        metadata: { organizationId: 'org_123' },
      });

      expect(session.id).toBe('sess_123');
      expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          success_url: 'https://success',
          cancel_url: 'https://cancel',
          customer: 'cus_123',
        }),
      );
    });
  });

  describe('createPaymentCheckoutSession', () => {
    it('should call stripeClient.checkout.sessions.create in payment mode', async () => {
      const mockSession = { id: 'sess_pay_123' };
      stripeMock.checkout.sessions.create.mockResolvedValue(mockSession);

      const session = await service.createPaymentCheckoutSession({
        successUrl: 'https://success',
        cancelUrl: 'https://cancel',
        lineItems: [{ price: 'price_456', quantity: 2 }],
      });

      expect(session.id).toBe('sess_pay_123');
      expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'payment' }),
      );
    });
  });

  describe('retrieveSubscription', () => {
    it('should call stripeClient.subscriptions.retrieve', async () => {
      stripeMock.subscriptions.retrieve.mockResolvedValue({ id: 'sub_123', status: 'active' });
      const sub = await service.retrieveSubscription('sub_123');
      expect(sub.id).toBe('sub_123');
      expect(sub.status).toBe('active');
      expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledWith('sub_123');
    });
  });

  describe('cancelSubscription', () => {
    it('should call stripeClient.subscriptions.cancel', async () => {
      stripeMock.subscriptions.cancel.mockResolvedValue({ id: 'sub_123', status: 'canceled' });
      const result = await service.cancelSubscription('sub_123');
      expect(result.status).toBe('canceled');
      expect(stripeMock.subscriptions.cancel).toHaveBeenCalledWith('sub_123');
    });
  });

  describe('createBillingPortalSession', () => {
    it('should call stripeClient.billingPortal.sessions.create', async () => {
      stripeMock.billingPortal.sessions.create.mockResolvedValue({
        id: 'bps_123',
        url: 'https://billing.stripe.com/portal/123',
      });
      const portal = await service.createBillingPortalSession('cus_123', 'https://return-url');
      expect(portal.url).toBe('https://billing.stripe.com/portal/123');
      expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        return_url: 'https://return-url',
      });
    });
  });

  describe('constructEvent', () => {
    it('should call stripeClient.webhooks.constructEvent with correct args', () => {
      const mockEvent = { type: 'checkout.session.completed', id: 'evt_123' };
      stripeMock.webhooks.constructEvent.mockReturnValue(mockEvent);
      const payload = Buffer.from('{}');
      const result = service.constructEvent(payload, 'sig_test', 'whsec_test');
      expect(result.type).toBe('checkout.session.completed');
      expect(stripeMock.webhooks.constructEvent).toHaveBeenCalledWith(payload, 'sig_test', 'whsec_test');
    });
  });
});
