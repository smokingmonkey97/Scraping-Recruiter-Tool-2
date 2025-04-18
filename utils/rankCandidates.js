// utils/rankCandidates.js
const { OpenAI } = require('openai');
const dotenv = require('dotenv');

dotenv.config();

// Initialize OpenAI for enhanced summaries if API key is available
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

/**
 * Industry definitions for cross-industry generalization
 * Each industry has: 
 * - keywords (for detection)
 * - topCompanies (for reputation scoring)
 * - experienceMultiplier (to adjust experience weight by industry)
 * - seniorityTerms (industry-specific seniority terms)
 * - juniorTerms (industry-specific junior terms)
 * - specializations (key areas within the industry)
 * - commonSkills (typical valued skills in the industry)
 */
const INDUSTRIES = {
  tech: {
    keywords: ['software', 'developer', 'engineer', 'programming', 'code', 'technical', 'IT', 'data', 'DevOps'],
    topCompanies: [
      'google', 'alphabet', 'microsoft', 'amazon', 'meta', 'facebook', 'apple', 'netflix', 'stripe', 
      'shopify', 'airbnb', 'uber', 'linkedin', 'twitter', 'salesforce', 'adobe', 'dropbox', 'hubspot',
      'atlassian', 'square', 'twilio', 'datadog', 'snowflake', 'mongodb'
    ],
    experienceMultiplier: 1.0,
    seniorityTerms: ['senior', 'staff', 'principal', 'architect', 'lead'],
    juniorTerms: ['junior', 'associate', 'entry', 'intern'],
    specializations: {
      'frontend': ['frontend', 'front-end', 'ui', 'react', 'angular', 'vue', 'javascript'],
      'backend': ['backend', 'back-end', 'server', 'api', 'database', 'java', 'python', 'go', 'ruby'],
      'fullstack': ['fullstack', 'full-stack', 'full stack'],
      'devops': ['devops', 'infrastructure', 'cloud', 'aws', 'azure', 'gcp', 'kubernetes', 'docker'],
      'mobile': ['mobile', 'ios', 'android', 'react native', 'flutter'],
      'data': ['data scientist', 'data engineer', 'machine learning', 'ai', 'ml', 'analytics'],
      'qa': ['qa', 'quality', 'testing', 'test', 'automation'],
      'security': ['security', 'penetration', 'devsecops', 'cybersecurity']
    },
    commonSkills: [
      'JavaScript', 'Python', 'Java', 'C#', 'PHP', 'TypeScript', 'Ruby', 'Swift', 'Go',
      'React', 'Angular', 'Vue', 'Node.js', 'Django', 'Rails', 'Laravel',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD',
      'SQL', 'NoSQL', 'MongoDB', 'PostgreSQL', 'MySQL',
      'Machine Learning', 'AI', 'Big Data', 'Hadoop', 'Spark',
      'Agile', 'Scrum', 'Kanban', 'TDD', 'DevOps'
    ]
  },
  finance: {
    keywords: ['finance', 'accounting', 'financial', 'investment', 'banking', 'trading', 'audit', 'tax', 'wealth'],
    topCompanies: [
      'jpmorgan', 'goldman sachs', 'morgan stanley', 'blackrock', 'wells fargo', 'citi', 'bank of america',
      'capital one', 'american express', 'mastercard', 'visa', 'fidelity', 'vanguard', 'charles schwab', 
      'deloitte', 'pwc', 'kpmg', 'ey', 'hsbc', 'barclays', 'credit suisse', 'ubs'
    ],
    experienceMultiplier: 1.2, // Finance values experience heavily
    seniorityTerms: ['senior', 'director', 'vp', 'vice president', 'principal', 'managing', 'partner', 'cfo'],
    juniorTerms: ['junior', 'associate', 'analyst', 'intern', 'trainee'],
    specializations: {
      'accounting': ['accountant', 'accounting', 'audit', 'tax', 'controller'],
      'investment': ['investment', 'portfolio', 'asset', 'wealth', 'fund'],
      'banking': ['banking', 'credit', 'lending', 'mortgage', 'loan'],
      'trading': ['trading', 'trader', 'securities', 'exchange', 'market'],
      'risk': ['risk', 'compliance', 'regulatory', 'regulation'],
      'fintech': ['fintech', 'financial technology', 'payment', 'blockchain', 'crypto']
    },
    commonSkills: [
      'Financial Analysis', 'Accounting', 'Forecasting', 'Budgeting', 'Valuation',
      'Financial Modeling', 'Excel', 'VBA', 'Bloomberg Terminal', 'Capital Markets',
      'Risk Management', 'Compliance', 'Regulations', 'Tax', 'Audit',
      'CPA', 'CFA', 'MBA', 'Series 7', 'Series 63',
      'M&A', 'Due Diligence', 'Financial Reporting', 'GAAP', 'IFRS'
    ]
  },
  healthcare: {
    keywords: ['healthcare', 'medical', 'clinical', 'health', 'patient', 'hospital', 'pharmaceutical', 'biotech'],
    topCompanies: [
      'unitedhealth', 'johnson & johnson', 'pfizer', 'roche', 'novartis', 'merck', 'abbvie', 'eli lilly',
      'cvs health', 'anthem', 'cigna', 'humana', 'hca healthcare', 'medtronic', 'abbott', 'amgen', 
      'cleveland clinic', 'mayo clinic', 'kaiser permanente', 'memorial sloan kettering'
    ],
    experienceMultiplier: 1.1, // Healthcare values experience
    seniorityTerms: ['senior', 'chief', 'head', 'director', 'attending', 'fellow', 'lead'],
    juniorTerms: ['junior', 'resident', 'intern', 'assistant', 'trainee'],
    specializations: {
      'clinical': ['physician', 'doctor', 'surgeon', 'nurse', 'practitioner', 'therapist'],
      'research': ['research', 'clinical research', 'pharmaceutical', 'biotech', 'scientist'],
      'administration': ['healthcare admin', 'hospital admin', 'practice management'],
      'technical': ['health it', 'medical device', 'biomedical', 'health informatics'],
      'public': ['public health', 'epidemiology', 'health policy', 'community health']
    },
    commonSkills: [
      'Patient Care', 'Clinical', 'Electronic Health Records', 'Epic', 'Cerner',
      'HIPAA', 'Medical Coding', 'ICD-10', 'CPT', 'Diagnosis',
      'Treatment Planning', 'Care Coordination', 'Medical Billing',
      'Clinical Trials', 'Research', 'FDA Regulations', 'GCP', 'IRB',
      'MD', 'RN', 'PA', 'NP', 'PharmD', 'PhD'
    ]
  },
  legal: {
    keywords: ['legal', 'law', 'attorney', 'lawyer', 'counsel', 'compliance', 'regulatory', 'contract', 'litigation'],
    topCompanies: [
      'kirkland & ellis', 'latham & watkins', 'baker mckenzie', 'dla piper', 'skadden', 'cravath',
      'white & case', 'clifford chance', 'allen & overy', 'linklaters', 'freshfields', 'gibson dunn',
      'wachtell lipton', 'jones day', 'sidley austin', 'morgan lewis', 'hogan lovells'
    ],
    experienceMultiplier: 1.3, // Legal heavily values experience
    seniorityTerms: ['senior', 'partner', 'counsel', 'associate', 'of counsel', 'chief', 'general counsel'],
    juniorTerms: ['junior', 'associate', 'clerk', 'paralegal', 'intern'],
    specializations: {
      'corporate': ['corporate', 'transactional', 'm&a', 'securities', 'finance'],
      'litigation': ['litigation', 'trial', 'dispute', 'appellate'],
      'regulatory': ['regulatory', 'compliance', 'administrative'],
      'intellectual': ['intellectual property', 'patent', 'trademark', 'copyright'],
      'employment': ['employment', 'labor', 'benefits', 'compensation'],
      'tax': ['tax', 'estate', 'trust']
    },
    commonSkills: [
      'Legal Research', 'Legal Writing', 'Contract Drafting', 'Negotiation', 'Due Diligence',
      'Litigation', 'Case Management', 'Discovery', 'Trial Preparation', 'Deposition',
      'Corporate Law', 'M&A', 'Compliance', 'Regulatory', 'Intellectual Property',
      'JD', 'LLM', 'Bar Admission', 'Westlaw', 'LexisNexis'
    ]
  },
  hr: {
    keywords: ['hr', 'human resources', 'talent', 'recruiting', 'recruitment', 'people', 'learning', 'development', 'benefits', 'compensation'],
    topCompanies: [
      'workday', 'adp', 'sap', 'oracle', 'linkedin', 'indeed', 'glassdoor', 'cornerstone', 'paycom',
      'paychex', 'bamboo hr', 'greenhouse', 'lever', 'mercer', 'aon', 'willis towers watson'
    ],
    experienceMultiplier: 0.9, // HR values other factors beyond pure experience
    seniorityTerms: ['senior', 'director', 'chief', 'head', 'lead', 'principal', 'vp'],
    juniorTerms: ['junior', 'associate', 'assistant', 'coordinator', 'specialist'],
    specializations: {
      'recruiting': ['recruiter', 'talent acquisition', 'sourcing', 'headhunter'],
      'generalist': ['hr generalist', 'hrbp', 'business partner'],
      'comp': ['compensation', 'benefits', 'total rewards', 'payroll'],
      'learning': ['learning', 'development', 'training', 'organizational development'],
      'employee': ['employee relations', 'engagement', 'culture', 'experience']
    },
    commonSkills: [
      'Recruiting', 'Talent Acquisition', 'Onboarding', 'Employee Relations', 'Performance Management',
      'Compensation', 'Benefits', 'HRIS', 'Workday', 'ADP', 'Payroll',
      'Learning & Development', 'Training', 'Succession Planning', 'Engagement',
      'HR Compliance', 'FLSA', 'ADA', 'FMLA', 'EEO', 'SHRM-CP', 'SHRM-SCP', 'PHR', 'SPHR'
    ]
  },
  marketing: {
    keywords: ['marketing', 'brand', 'digital', 'product marketing', 'growth', 'seo', 'content', 'communications', 'social media'],
    topCompanies: [
      'procter & gamble', 'unilever', 'coca-cola', 'pepsico', 'nestle', 'l\'oréal',
      'google', 'facebook', 'amazon', 'microsoft', 'apple', 'netflix',
      'wpp', 'omnicom', 'publicis', 'interpublic', 'dentsu', 'ogilvy', 'mccann'
    ],
    experienceMultiplier: 0.9, // Marketing values creativity/results alongside experience
    seniorityTerms: ['senior', 'director', 'head', 'lead', 'chief', 'vp', 'principal'],
    juniorTerms: ['junior', 'associate', 'assistant', 'coordinator', 'specialist'],
    specializations: {
      'digital': ['digital', 'online', 'web', 'conversion', 'acquisition', 'seo', 'sem', 'ppc'],
      'brand': ['brand', 'branding', 'creative', 'design', 'advertising'],
      'content': ['content', 'editorial', 'copywriting', 'blogging'],
      'product': ['product marketing', 'product management', 'go-to-market'],
      'growth': ['growth', 'acquisition', 'retention', 'lifecycle'],
      'communications': ['communications', 'pr', 'public relations', 'media relations']
    },
    commonSkills: [
      'Digital Marketing', 'SEO', 'SEM', 'Social Media', 'Content Marketing',
      'Campaign Management', 'Google Analytics', 'Google Ads', 'Facebook Ads', 'Marketing Automation',
      'Hubspot', 'Marketo', 'Mailchimp', 'Salesforce', 'Adobe Creative Suite',
      'Brand Strategy', 'Market Research', 'Customer Segmentation', 'A/B Testing',
      'CRO', 'Marketing ROI', 'Growth Marketing', 'Product Marketing'
    ]
  },
  sales: {
    keywords: ['sales', 'account', 'business development', 'revenue', 'customer success', 'client', 'relationship'],
    topCompanies: [
      'salesforce', 'oracle', 'sap', 'microsoft', 'ibm', 'google', 'amazon', 'adobe',
      'hubspot', 'zendesk', 'zoho', 'outreach', 'gong', 'salesloft', 'zoominfo',
      'dell', 'hp', 'cisco', 'vmware', 'workday', 'servicenow'
    ],
    experienceMultiplier: 0.8, // Sales often values results over years of experience
    seniorityTerms: ['senior', 'director', 'vp', 'chief', 'head', 'lead', 'principal'],
    juniorTerms: ['junior', 'associate', 'business development representative', 'sales development representative', 'inside sales'],
    specializations: {
      'account': ['account executive', 'key account', 'enterprise', 'strategic'],
      'business': ['business development', 'partnerships', 'alliances', 'channel'],
      'customer': ['customer success', 'account management', 'client services'],
      'inside': ['inside sales', 'sales development', 'business development'],
      'field': ['field sales', 'territory', 'regional', 'district', 'area']
    },
    commonSkills: [
      'B2B Sales', 'B2C Sales', 'Enterprise Sales', 'Solution Selling', 'Consultative Selling',
      'Negotiation', 'Prospecting', 'Lead Generation', 'Pipeline Management', 'Closing',
      'CRM', 'Salesforce', 'Hubspot', 'Sales Operations', 'Sales Enablement',
      'Customer Relationship Management', 'Account Management', 'Territory Management',
      'Forecasting', 'Quota Attainment', 'Revenue Growth'
    ]
  }
};

/**
 * Common cross-industry seniority levels and experience ranges
 */
const SENIORITY_LEVELS = [
  { level: 'Entry', years: [0, 2], weight: 1 },
  { level: 'Junior', years: [1, 3], weight: 2 },
  { level: 'Mid-Level', years: [3, 6], weight: 3 },
  { level: 'Senior', years: [5, 10], weight: 4 },
  { level: 'Lead', years: [7, 15], weight: 5 },
  { level: 'Manager', years: [5, 15], weight: 5 },
  { level: 'Director', years: [10, 20], weight: 6 },
  { level: 'VP', years: [12, 25], weight: 7 },
  { level: 'Executive', years: [15, 30], weight: 8 }
];

/**
 * Confidence levels for candidate data quality
 */
const CONFIDENCE_LEVELS = [
  { level: 'Low', threshold: 25, label: 'Needs More Information' },
  { level: 'Medium', threshold: 50, label: 'Potential Match' },
  { level: 'High', threshold: 75, label: 'Strong Match' },
  { level: 'Very High', threshold: 90, label: 'Excellent Match' }
];

/**
 * Ranks and enriches real candidate data with scores, tags and summaries
 * @param {Array} candidates - Array of real candidate objects from scraping
 * @param {Object} options - Optional parameters for ranking
 * @param {string} options.jobDescription - Job description text for matching
 * @param {string} options.industry - Specified industry for better matching
 * @param {number} options.requiredExperience - Minimum years of experience required
 * @param {Array} options.requiredSkills - List of required skills
 * @returns {Array} - Ranked and enriched candidate data
 */
const rankCandidates = async (candidates, options = {}) => {
  if (!candidates || candidates.length === 0) {
    throw new Error('No candidates provided for ranking');
  }

  const {
    jobDescription = '',
    industry = '',
    requiredExperience = 0,
    requiredSkills = []
  } = options;

  try {
    console.log(`🔢 Ranking ${candidates.length} candidates...`);
    
    // Detect industry if not explicitly provided
    const detectedIndustry = industry || detectIndustry(candidates, jobDescription);
    console.log(`🏢 Using industry profile: ${detectedIndustry}`);
    
    // Get industry profile
    const industryProfile = INDUSTRIES[detectedIndustry] || INDUSTRIES.tech;
    
    // Step 1: Calculate scores and add basic tags for each candidate
    const scoredCandidates = candidates.map(candidate => {
      const {
        name,
        title = "",
        location = "",
        experience = 0,
        company = "",
        email = "",
        linkedin = "",
        source = "",
        // Additional fields that might be available
        connectionDegree = "",
        experienceDetails = [],
        apolloId = "",
        skills = []
      } = candidate;

      // Determine data completeness for confidence scoring
      const dataPoints = {
        hasTitle: !!title,
        hasCompany: !!company,
        hasLocation: !!location,
        hasExperience: experience > 0,
        hasEmail: !!email,
        hasLinkedin: !!linkedin,
        hasSkills: Array.isArray(skills) && skills.length > 0,
        hasExperienceDetails: Array.isArray(experienceDetails) && experienceDetails.length > 0
      };
      
      const dataCompleteness = calculateDataCompleteness(dataPoints);
      
      // Normalize and extract skills
      const normalizedSkills = normalizeSkills(skills, title, industryProfile);
      
      // Calculate comprehensive score based on industry
      const scoreDetails = calculateCandidateScore({
        title,
        experience,
        company,
        location,
        dataCompleteness,
        normalizedSkills,
        experienceDetails,
        connectionDegree,
        email,
        industryProfile,
        requiredExperience,
        requiredSkills,
        jobDescription
      });
      
      // Determine seniority level
      const seniorityLevel = determineSeniorityLevel(experience, title, industryProfile);
      
      // Generate comprehensive tags
      const tags = generateTags(title, experience, company, location, normalizedSkills, industryProfile, seniorityLevel);
      
      // Include source in tags
      if (source && !tags.includes(source.toLowerCase())) {
        tags.push(source.toLowerCase());
      }

      // Generate confidence level
      const confidenceLevel = determineConfidenceLevel(scoreDetails.score, dataCompleteness);

      // Generate detailed summary
      const summary = generateDetailedSummary({
        title,
        experience,
        company,
        experienceDetails,
        normalizedSkills,
        seniorityLevel,
        confidenceLevel,
        industryProfile,
        scoreDetails
      });

      // Return enhanced candidate object
      return {
        name,
        title,
        location,
        company,
        email,
        linkedin,
        experience,
        source,
        score: scoreDetails.score,
        confidenceLevel,
        seniorityLevel,
        scoreDetails,
        summary,
        tags,
        skills: normalizedSkills,
        dataCompleteness,
        // Keep any additional data for reference
        apolloId: apolloId || undefined,
        connectionDegree: connectionDegree || undefined,
        experienceDetails: experienceDetails.length > 0 ? experienceDetails : undefined
      };
    });

    // Step 2: Sort candidates by score (highest first)
    scoredCandidates.sort((a, b) => b.score - a.score);
    
    // Step 3: Use OpenAI to enhance summaries if available (for top candidates)
    if (openai) {
      try {
        await enhanceSummariesWithAI(scoredCandidates.slice(0, 5), jobDescription, industryProfile);
      } catch (aiError) {
        console.warn('⚠️ OpenAI enhancement failed:', aiError.message);
        // Continue without AI enhancement
      }
    }
    
    console.log(`✅ Ranking complete. Top candidate: ${scoredCandidates[0]?.name} (${scoredCandidates[0]?.score}/100)`);
    return scoredCandidates;
  } catch (error) {
    console.error('❌ Error in rankCandidates:', error);
    throw new Error(`Failed to rank candidates: ${error.message}`);
  }
};

/**
 * Detect the industry based on job titles in candidates and job description
 * @param {Array} candidates - List of candidates
 * @param {string} jobDescription - Job description if available
 * @returns {string} - Detected industry key
 */
function detectIndustry(candidates, jobDescription = '') {
  const titles = candidates.map(c => c.title || '').filter(t => t);
  const allText = [...titles, jobDescription].join(' ').toLowerCase();
  
  // Count keyword matches for each industry
  const industryMatches = Object.entries(INDUSTRIES).map(([key, industry]) => {
    const matches = industry.keywords.filter(keyword => 
      allText.includes(keyword.toLowerCase())
    ).length;
    return { industry: key, matches };
  });
  
  // Sort by matches (descending)
  industryMatches.sort((a, b) => b.matches - a.matches);
  
  // Return the industry with the most matches, default to tech if no matches
  return industryMatches[0]?.matches > 0 ? industryMatches[0].industry : 'tech';
}

/**
 * Calculate completeness of candidate data
 * @param {Object} dataPoints - Object containing boolean flags for each data point
 * @returns {number} - Data completeness score (0-100)
 */
function calculateDataCompleteness(dataPoints) {
  // Define weights for different data points
  const weights = {
    hasTitle: 20,
    hasCompany: 20,
    hasLocation: 10,
    hasExperience: 15,
    hasEmail: 10,
    hasLinkedin: 5,
    hasSkills: 10,
    hasExperienceDetails: 10
  };
  
  // Calculate weighted score
  let score = 0;
  let totalWeight = 0;
  
  for (const [key, has] of Object.entries(dataPoints)) {
    const weight = weights[key] || 0;
    totalWeight += weight;
    if (has) score += weight;
  }
  
  // Normalize to 0-100
  return Math.round((score / totalWeight) * 100);
}

/**
 * Normalize and enhance skills list
 * @param {Array} skills - Raw skills array
 * @param {string} title - Job title to extract additional skills from
 * @param {Object} industryProfile - Industry profile for common skills
 * @returns {Array} - Normalized and enhanced skills list
 */
function normalizeSkills(skills = [], title = '', industryProfile) {
  // Start with existing skills
  let normalizedSkills = Array.isArray(skills) ? [...skills] : [];
  
  // Extract potential skills from title
  if (title) {
    // Check if any industry skills appear in the title
    const titleLower = title.toLowerCase();
    industryProfile.commonSkills.forEach(skill => {
      if (titleLower.includes(skill.toLowerCase()) && 
          !normalizedSkills.some(s => s.toLowerCase() === skill.toLowerCase())) {
        normalizedSkills.push(skill);
      }
    });
    
    // Check if any specializations appear in the title
    Object.entries(industryProfile.specializations).forEach(([area, keywords]) => {
      if (keywords.some(keyword => titleLower.includes(keyword.toLowerCase()))) {
        normalizedSkills.push(area);
      }
    });
  }
  
  // Remove duplicates and standardize
  const uniqueSkills = [...new Set(normalizedSkills.map(s => s.trim()))];
  
  return uniqueSkills;
}

/**
 * Calculate a comprehensive candidate score
 * @param {Object} params - Scoring parameters
 * @returns {Object} - Score details with total and component scores
 */
function calculateCandidateScore(params) {
  const {
    title = "",
    experience = 0,
    company = "",
    location = "",
    dataCompleteness = 0,
    normalizedSkills = [],
    experienceDetails = [],
    connectionDegree = "",
    email = "",
    industryProfile,
    requiredExperience = 0,
    requiredSkills = [],
    jobDescription = ""
  } = params;
  
  const scoreDetails = {
    experienceScore: 0,
    titleScore: 0,
    companyScore: 0,
    skillsScore: 0,
    jobFitScore: 0,
    contactInfoScore: 0,
    dataQualityScore: 0,
    score: 0 // Total score
  };
  
  // 1. Experience scoring (0-25 points, weighted by industry)
  if (experience > 0) {
    // Base points for experience (max 20 points)
    const baseExperienceScore = Math.min(experience * 2, 20);
    
    // Adjust by industry multiplier
    scoreDetails.experienceScore = Math.round(baseExperienceScore * industryProfile.experienceMultiplier);
    
    // Bonus for meeting/exceeding required experience
    if (requiredExperience > 0 && experience >= requiredExperience) {
      scoreDetails.experienceScore += 5;
    }
    
    // Cap at 25
    scoreDetails.experienceScore = Math.min(scoreDetails.experienceScore, 25);
  }
  
  // 2. Title scoring (0-20 points)
  if (title) {
    const titleLower = title.toLowerCase();
    scoreDetails.titleScore = 5; // Base score for having a title
    
    // Seniority scoring based on industry-specific terms
    if (industryProfile.seniorityTerms.some(term => titleLower.includes(term))) {
      scoreDetails.titleScore += 10;
    } else if (titleLower.includes('manager') || titleLower.includes('director')) {
      scoreDetails.titleScore += 8;
    } else if (titleLower.includes('specialist') || titleLower.includes('analyst')) {
      scoreDetails.titleScore += 5;
    } else if (industryProfile.juniorTerms.some(term => titleLower.includes(term))) {
      scoreDetails.titleScore += 3;
    }
    
    // Relevance to job description if provided
    if (jobDescription) {
      const relevanceScore = calculateTextRelevance(title, jobDescription);
      scoreDetails.titleScore += Math.round(relevanceScore * 5); // Up to 5 additional points
    }
    
    // Cap at 20
    scoreDetails.titleScore = Math.min(scoreDetails.titleScore, 20);
  }
  
  // 3. Company reputation scoring (0-15 points)
  if (company) {
    scoreDetails.companyScore = 5; // Base score for having company info
    
    // Check if company is in the industry's top companies list
    const companyLower = company.toLowerCase();
    if (industryProfile.topCompanies.some(c => companyLower.includes(c))) {
      scoreDetails.companyScore += 10;
    }
    
    // Check for keywords indicating company size/prestige
    if (/global|worldwide|international|leading|top/i.test(company)) {
      scoreDetails.companyScore += 3;
    }
    
    // Cap at 15
    scoreDetails.companyScore = Math.min(scoreDetails.companyScore, 15);
  }
  
  // 4. Skills scoring (0-20 points)
  if (normalizedSkills.length > 0) {
    // Base points for having skills
    scoreDetails.skillsScore = Math.min(normalizedSkills.length, 5);
    
    // Check for required skills
    if (requiredSkills.length > 0) {
      const matchedSkills = requiredSkills.filter(skill => 
        normalizedSkills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
      );
      
      if (matchedSkills.length > 0) {
        // Up to 15 additional points based on match percentage
        const matchRatio = matchedSkills.length / requiredSkills.length;
        scoreDetails.skillsScore += Math.round(matchRatio * 15);
      }
    } else if (industryProfile.commonSkills.length > 0) {
      // If no required skills specified, match against industry common skills
      const industrySkillMatches = normalizedSkills.filter(skill => 
        industryProfile.commonSkills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
      );
      
      if (industrySkillMatches.length > 0) {
        // Up to 10 additional points
        scoreDetails.skillsScore += Math.min(industrySkillMatches.length * 2, 10);
      }
    }
    
    // Cap at 20
    scoreDetails.skillsScore = Math.min(scoreDetails.skillsScore, 20);
  }
  
  // 5. Job fit scoring (0-15 points)
  if (jobDescription) {
    // Calculate overall relevance to job description
    const overallRelevance = calculateJobRelevance({
      title,
      company,
      skills: normalizedSkills,
      experience,
      jobDescription
    });
    
    scoreDetails.jobFitScore = Math.round(overallRelevance * 15);
  } else {
    // If no job description provided, default score based on data quality
    scoreDetails.jobFitScore = Math.round(dataCompleteness / 10);
  }
  
  // 6. Contact info scoring (0-10 points)
  scoreDetails.contactInfoScore = 0;
  if (email && email.includes('@')) scoreDetails.contactInfoScore += 5;
  if (connectionDegree && connectionDegree.includes('1st')) scoreDetails.contactInfoScore += 2;
  
  // Cap at 10
  scoreDetails.contactInfoScore = Math.min(scoreDetails.contactInfoScore, 10);
  
  // 7. Data quality/completeness (0-10 points)
  scoreDetails.dataQualityScore = Math.round(dataCompleteness / 10);
  
  // Calculate total score (normalized to 0-100)
  scoreDetails.score = Math.max(0, Math.min(100, Math.floor(
    scoreDetails.experienceScore +
    scoreDetails.titleScore +
    scoreDetails.companyScore +
    scoreDetails.skillsScore +
    scoreDetails.jobFitScore +
    scoreDetails.contactInfoScore +
    scoreDetails.dataQualityScore
  )));

  return scoreDetails;
}

/**
 * Calculate text relevance between two text strings
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {number} - Relevance score (0-1)
 */
function calculateTextRelevance(text1, text2) {
  if (!text1 || !text2) return 0;
  
  const words1 = text1.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const words2 = text2.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  
  const matchingWords = words1.filter(word => words2.includes(word));
  
  // Calculate Jaccard similarity
  const union = new Set([...words1, ...words2]);
  return matchingWords.length / union.size;
}

/**
 * Calculate relevance to job description
 * @param {Object} params - Parameters for calculation
 * @returns {number} - Relevance score (0-1)
 */
function calculateJobRelevance({ title, company, skills, experience, jobDescription }) {
  if (!jobDescription) return 0;
  
  const jobDescLower = jobDescription.toLowerCase();
  
  // 1. Title relevance
  const titleRelevance = title ? calculateTextRelevance(title, jobDescription) : 0;
  
  // 2. Skills relevance
  let skillsRelevance = 0;
  if (skills && skills.length > 0) {
    const matchedSkills = skills.filter(skill => 
      jobDescLower.includes(skill.toLowerCase())
    );
    skillsRelevance = skills.length > 0 ? matchedSkills.length / skills.length : 0;
  }
  
  // 3. Experience relevance
  // Extract experience requirements from job description
  const expMatches = jobDescription.match(/(\d+)[\+]?\s+years?(?:\s+of)?\s+experience/i);
  const requiredExp = expMatches ? parseInt(expMatches[1], 10) : 0;
  
  let expRelevance = 0;
  if (requiredExp > 0 && experience > 0) {
    // Calculate how well the candidate's experience matches the requirement
    expRelevance = experience >= requiredExp ? 1 : experience / requiredExp;
  } else {
    // Default if no specific requirement found
    expRelevance = experience > 3 ? 0.7 : 0.3;
  }
  
  // Weighted average of all factors
  return (titleRelevance * 0.4) + (skillsRelevance * 0.4) + (expRelevance * 0.2);
}

/**
 * Determine seniority level based on experience and title
 * @param {number} experience - Years of experience
 * @param {string} title - Job title
 * @param {Object} industryProfile - Industry profile
 * @returns {string} - Seniority level
 */
function determineSeniorityLevel(experience, title = '', industryProfile) {
  // Start with experience-based level
  let level = '';
  for (const seniority of SENIORITY_LEVELS) {
    if (experience >= seniority.years[0] && (!level || seniority.weight > SENIORITY_LEVELS.find(s => s.level === level).weight)) {
      level = seniority.level;
    }
  }
  
  // Adjust based on title if available
  if (title) {
    const titleLower = title.toLowerCase();
    
    // Check for management/leadership terms
    if (/chief|cxo|c-level|ceo|cto|cfo|coo|president/i.test(titleLower)) {
      return 'Executive';
    }
    
    if (/vp|vice president/i.test(titleLower)) {
      return 'VP';
    }
    
    if (/director|head of/i.test(titleLower)) {
      return 'Director';
    }
    
    if (/manager|management/i.test(titleLower) && !(/assistant|associate/i.test(titleLower))) {
      return 'Manager';
    }
    
    if (/lead|principal|staff/i.test(titleLower)) {
      return 'Lead';
    }
    
    // Check for industry-specific seniority terms
    if (industryProfile.seniorityTerms.some(term => titleLower.includes(term))) {
      return 'Senior';
    }
    
    // Check for industry-specific junior terms
    if (industryProfile.juniorTerms.some(term => titleLower.includes(term))) {
      return experience > 3 ? 'Mid-Level' : 'Junior';
    }
  }
  
  return level || 'Mid-Level'; // Default if no conclusive indicators
}

/**
 * Determine confidence level based on score and data completeness
 * @param {number} score - Calculated score
 * @param {number} dataCompleteness - Data completeness percentage
 * @returns {Object} - Confidence level object
 */
function determineConfidenceLevel(score, dataCompleteness) {
  // Adjust score based on data completeness
  const adjustedScore = score * (dataCompleteness / 100);
  
  // Find appropriate confidence level
  for (let i = CONFIDENCE_LEVELS.length - 1; i >= 0; i--) {
    if (adjustedScore >= CONFIDENCE_LEVELS[i].threshold) {
      return {
        level: CONFIDENCE_LEVELS[i].level,
        label: CONFIDENCE_LEVELS[i].label,
        score: adjustedScore
      };
    }
  }
  
  // Default lowest confidence level
  return {
    level: CONFIDENCE_LEVELS[0].level,
    label: CONFIDENCE_LEVELS[0].label,
    score: adjustedScore
  };
}

/**
 * Generate comprehensive tags for a candidate
 * @param {string} title - Job title
 * @param {number} experience - Years of experience
 * @param {string} company - Company name
 * @param {string} location - Location
 * @param {Array} skills - Normalized skills array
 * @param {Object} industryProfile - Industry profile
 * @param {string} seniorityLevel - Determined seniority level
 * @returns {Array} - Array of tags
 */
function generateTags(title, experience, company, location, skills = [], industryProfile, seniorityLevel) {
  const tags = [];
  
  // Add seniority level as tag
  if (seniorityLevel) {
    tags.push(seniorityLevel.toLowerCase().replace(/\s+/g, '-'));
  }
  
  // Add location-based tags
  if (location) {
    if (/remote/i.test(location) || /remote/i.test(title)) {
      tags.push("remote");
    }
    
    // Extract region/country
    const locationParts = location.split(/,|\s+/).map(p => p.trim().toLowerCase());
    const regions = ['usa', 'us', 'uk', 'canada', 'europe', 'apac', 'asia', 'australia'];
    
    regions.forEach(region => {
      if (locationParts.includes(region) || location.toLowerCase().includes(region)) {
        tags.push(region);
      }
    });
  }
  
  // Add industry specialization tags
  if (title && industryProfile.specializations) {
    const titleLower = title.toLowerCase();
    
    Object.entries(industryProfile.specializations).forEach(([specialization, keywords]) => {
      if (keywords.some(keyword => titleLower.includes(keyword.toLowerCase()))) {
        tags.push(specialization);
      }
    });
  }
  
  // Add top company tag if applicable
  if (company && industryProfile.topCompanies) {
    const companyLower = company.toLowerCase();
    if (industryProfile.topCompanies.some(c => companyLower.includes(c))) {
      tags.push("top-company");
    }
  }
  
  // Add key skills as tags (limit to 5 to avoid tag explosion)
  if (skills && Array.isArray(skills)) {
    skills.slice(0, 5).forEach(skill => {
      // Convert skill to kebab-case tag format
      const skillTag = skill.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (skillTag && !tags.includes(skillTag)) {
        tags.push(skillTag);
      }
    });
  }
  
  // Add industry tag
  Object.keys(INDUSTRIES).forEach(key => {
    if (key === industryProfile.key || 
        (title && industryProfile.keywords.some(k => title.toLowerCase().includes(k.toLowerCase())))) {
      tags.push(key);
    }
  });
  
  // Deduplicate tags
  return [...new Set(tags)];
}

/**
 * Generate a detailed summary for a candidate based on available info
 * @param {Object} params - Parameters for summary generation
 * @returns {string} - Detailed candidate summary
 */
function generateDetailedSummary(params) {
  const {
    title,
    experience,
    company,
    experienceDetails = [],
    normalizedSkills = [],
    seniorityLevel,
    confidenceLevel,
    industryProfile,
    scoreDetails
  } = params;
  
  // Build summary parts
  const parts = [];
  
  // Experience and title part
  let experiencePart = '';
  if (experience > 0) {
    experiencePart = `${experience}+ years of experience`;
    if (title && company) {
      experiencePart += `, currently as ${title} at ${company}`;
    } else if (title) {
      experiencePart += ` as ${title}`;
    }
    experiencePart += '.';
  } else if (title && company) {
    experiencePart = `Currently ${title} at ${company}.`;
  } else if (title) {
    experiencePart = `Current role: ${title}.`;
  }
  
  if (experiencePart) {
    parts.push(experiencePart);
  }
  
  // Seniority description
  if (seniorityLevel) {
    let seniorityDesc = '';
    switch (seniorityLevel) {
      case 'Executive':
        seniorityDesc = 'Executive leader with significant strategic experience.';
        break;
      case 'VP':
        seniorityDesc = 'Senior leader with extensive management experience.';
        break;
      case 'Director':
        seniorityDesc = 'Experienced director with team and departmental leadership skills.';
        break;
      case 'Manager':
        seniorityDesc = 'Experienced manager with team leadership capabilities.';
        break;
      case 'Lead':
        seniorityDesc = 'Technical leader with strong domain expertise.';
        break;
      case 'Senior':
        seniorityDesc = 'Senior professional with deep industry knowledge.';
        break;
      case 'Mid-Level':
        seniorityDesc = 'Mid-level professional with practical expertise.';
        break;
      case 'Junior':
        seniorityDesc = 'Developing professional with foundational skills.';
        break;
      case 'Entry':
        seniorityDesc = 'Entry-level professional building initial experience.';
        break;
      default:
        seniorityDesc = 'Professional with relevant industry experience.';
    }
    parts.push(seniorityDesc);
  }
  
  // Work history insight
  if (experienceDetails && experienceDetails.length > 0) {
    const companies = experienceDetails
      .map(exp => exp.company)
      .filter((company, index, self) => self.indexOf(company) === index)
      .slice(0, 2);
    
    if (companies.length > 0) {
      let historyPart = `Past experience includes `;
      if (companies.length === 1) {
        historyPart += `work at ${companies[0]}`;
      } else {
        historyPart += `roles at ${companies.join(' and ')}`;
      }
      
      if (experienceDetails.length > companies.length) {
        historyPart += ' among others';
      }
      historyPart += '.';
      
      parts.push(historyPart);
    }
  }
  
  // Skills part
  if (normalizedSkills && normalizedSkills.length > 0) {
    const skillsPart = `Key skills include ${normalizedSkills.slice(0, 4).join(', ')}${normalizedSkills.length > 4 ? ' and more' : ''}.`;
    parts.push(skillsPart);
  }
  
  // Match assessment
  const matchPart = confidenceLevel ? 
    `${confidenceLevel.label} (${scoreDetails.score}/100).` : 
    `Candidate score: ${scoreDetails.score}/100.`;
  parts.push(matchPart);
  
  // Join all parts with spaces
  return parts.join(' ');
}

/**
 * Use OpenAI to enhance candidate summaries with AI insights
 * @param {Array} candidates - Top candidates to enhance
 * @param {string} jobDescription - Job description text if available
 * @param {Object} industryProfile - Industry profile
 */
async function enhanceSummariesWithAI(candidates, jobDescription = '', industryProfile) {
  if (!openai || candidates.length === 0) return;
  
  for (let candidate of candidates) {
    try {
      // Prepare candidate data for AI analysis
      const candidateData = {
        name: candidate.name,
        title: candidate.title,
        company: candidate.company,
        experience: candidate.experience,
        location: candidate.location,
        skills: candidate.skills || [],
        score: candidate.score,
        confidenceLevel: candidate.confidenceLevel,
        seniorityLevel: candidate.seniorityLevel,
        experienceDetails: candidate.experienceDetails || []
      };
      
      // Format job context for the AI
      const jobContext = jobDescription ? 
        `Job Description: ${jobDescription.substring(0, 200)}...` : 
        `Industry: ${Object.keys(INDUSTRIES).find(key => INDUSTRIES[key] === industryProfile) || 'Technology'}`;

      // Construct prompt for OpenAI
      const prompt = `
Generate a concise, professional candidate summary (2-3 sentences) for a hiring manager with these details:

CANDIDATE:
Name: ${candidateData.name}
Current Title: ${candidateData.title || 'Not specified'}
Current Company: ${candidateData.company || 'Not specified'}
Years of Experience: ${candidateData.experience || 'Not specified'}
Location: ${candidateData.location || 'Not specified'}
Skills: ${candidateData.skills.join(', ') || 'Not specified'}
Seniority Level: ${candidateData.seniorityLevel || 'Not specified'}
Confidence Score: ${candidateData.score}/100 (${candidateData.confidenceLevel?.level || 'Medium'})

CONTEXT:
${jobContext}

The summary should be:
1. Client-ready (professional, concise, objective)
2. Highlight key strengths and experience level
3. Standardized format that works well in a candidate report
4. Include the match score and confidence level
5. No marketing language, just factual assessment

Return ONLY the summary text with no additional labels or explanations.`;

      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo', // Use gpt-4 for better quality if available
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.7
      });

      // Update the candidate summary if successful
      if (response.choices && response.choices[0] && response.choices[0].message) {
        const aiSummary = response.choices[0].message.content.trim();
        
        if (aiSummary && aiSummary.length > 20) {
          candidate.summary = aiSummary;
          console.log(`✅ Enhanced summary for ${candidate.name}`);
        }
      }
      
      // Add a short delay between API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.warn(`⚠️ Failed to enhance summary for ${candidate.name}: ${error.message}`);
      // Continue with next candidate
    }
  }
}

module.exports = rankCandidates;