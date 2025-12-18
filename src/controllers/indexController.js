/**
 * Index Controller
 * Handles rendering of main website pages
 * 
 * @module controllers/indexController
 */
const controller = {};

/**
 * Render the home page
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
controller.index = (req, res, next) => {
  try {
    
    res.render("index", { title: "Express" });
      
  } catch (error) {
      next(error);
  } 
};

export default controller;
